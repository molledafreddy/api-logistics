// ...existing code...
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionAddon } from './entities/subscription-addon.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { PaymentEvent } from './entities/payment-event.entity';
import { Coupon } from './entities/coupon.entity';
import { PermissionsCacheService } from '../../common/cache/permissions-cache.service';

@Injectable()
export class SubscriptionsService implements OnModuleDestroy {
  async onModuleDestroy() {
    if (this.renewalQueue) {
      await this.renewalQueue.close();
    }
  }
  private readonly logger = new Logger(SubscriptionsService.name);
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionAddon)
    private readonly addonRepo: Repository<SubscriptionAddon>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceLineItem)
    private readonly invoiceLineItemRepo: Repository<InvoiceLineItem>,
    @InjectRepository(PaymentEvent)
    private readonly paymentEventRepo: Repository<PaymentEvent>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectQueue('subscription-renewal')
    private readonly renewalQueue: Queue,
    private readonly permissionsCache: PermissionsCacheService,
  ) {}

  // Métodos CRUD simulados para el sprint
  async createFreeSubscription(companyId: string, planId: string) {
    this.logger.debug(
      `[createFreeSubscription] companyId: ${companyId}, planId: ${planId}`,
    );
    // Cancelar suscripciones activas previas para evitar permisos combinados
    await this.subscriptionRepo.update(
      { company_id: companyId, status: 'active' as any },
      {
        status: 'canceled' as any,
        canceled_at: new Date(),
        cancel_at_period_end: false,
      },
    );
    const subscription = await this.subscriptionRepo.save({
      company_id: companyId,
      plan_id: planId,
      status: 'active',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancel_at_period_end: false,
    });
    this.logger.debug(
      `[createFreeSubscription] subscription creada: ${JSON.stringify(subscription)}`,
    );
    await this.permissionsCache.invalidate(companyId);
    // Encolar renovación automática
    await this.renewalQueue.add(
      'renew',
      { subscriptionId: subscription.id },
      {
        delay: 30 * 24 * 60 * 60 * 1000, // 30 días en ms
        jobId: subscription.id,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    return subscription;
  }

  async findByCompany(companyId: string) {
    this.logger.debug(`[findByCompany] companyId: ${companyId}`);
    return this.subscriptionRepo.find({ where: { company_id: companyId } });
  }

  async cancelSubscription(id: string) {
    this.logger.debug(`[cancelSubscription] id: ${id}`);
    return this.subscriptionRepo.update(id, {
      cancel_at_period_end: true,
      canceled_at: new Date(),
      status: 'canceled',
    });
  }

  async upgradeSubscription(id: string, newPlanId: string) {
    this.logger.debug(
      `[upgradeSubscription] id: ${id}, newPlanId: ${newPlanId}`,
    );
    await this.validatePlanChangeAudience(id, newPlanId, 'upgrade');
    const newStatus = await this.resolveStatusForPlan(newPlanId);

    // Si el plan requiere pago, NO cambiamos plan_id todavía — el usuario
    // conserva su plan actual hasta que el webhook confirme el pago.
    // pending_plan_id guarda el destino; applyEventToSubscription lo aplica.
    const updateData: Record<string, unknown> =
      newStatus === 'pending_payment'
        ? { status: newStatus, pending_plan_id: newPlanId }
        : {
            plan_id: newPlanId,
            status: newStatus,
            pending_plan_id: null,
            current_period_start: new Date(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            canceled_at: null,
            cancel_at_period_end: false,
          };

    const result = await this.subscriptionRepo.update(id, updateData as any);
    const sub = await this.subscriptionRepo.findOne({ where: { id } });
    if (sub) await this.permissionsCache.invalidate(sub.company_id);
    return result;
  }

  async downgradeSubscription(id: string, newPlanId: string) {
    this.logger.debug(
      `[downgradeSubscription] id: ${id}, newPlanId: ${newPlanId}`,
    );
    await this.validatePlanChangeAudience(id, newPlanId, 'downgrade');
    const newStatus = await this.resolveStatusForPlan(newPlanId);

    const updateData: Record<string, unknown> =
      newStatus === 'pending_payment'
        ? { status: newStatus, pending_plan_id: newPlanId }
        : {
            plan_id: newPlanId,
            status: newStatus,
            pending_plan_id: null,
            current_period_start: new Date(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            canceled_at: null,
            cancel_at_period_end: false,
          };

    const result = await this.subscriptionRepo.update(id, updateData as any);
    const sub = await this.subscriptionRepo.findOne({ where: { id } });
    if (sub) await this.permissionsCache.invalidate(sub.company_id);
    return result;
  }

  /** Devuelve 'pending_payment' si el plan tiene precio, 'active' si es gratuito. */
  private async resolveStatusForPlan(
    planId: string,
  ): Promise<'active' | 'pending_payment'> {
    const [row] = await this.subscriptionRepo.manager.query<
      { price: number }[]
    >(`SELECT price FROM plans WHERE id = $1`, [planId]);
    return row?.price > 0 ? 'pending_payment' : 'active';
  }

  /**
   * Valida que el cambio de plan sea compatible en términos de audiencia y tier.
   *
   * Reglas:
   * - enterprise_fleet (audience=any) es destino válido desde cualquier plan.
   * - El nuevo plan debe tener la misma audience que el plan actual, o audience='any'.
   * - Para upgrade: el nuevo tier debe ser >= al tier actual.
   * - Para downgrade: el nuevo tier debe ser <= al tier actual.
   */
  private async validatePlanChangeAudience(
    subscriptionId: string,
    newPlanId: string,
    direction: 'upgrade' | 'downgrade',
  ): Promise<void> {
    const tierOrder: Record<string, number> = {
      free: 0,
      pro: 1,
      enterprise: 2,
    };

    const sub = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    const [currentRows, newRows]: Array<
      Array<{ audience: string; tier: string; name: string }>
    > = await Promise.all([
      this.subscriptionRepo.manager.query(
        `SELECT audience, tier, name FROM plans WHERE id = $1`,
        [sub.plan_id],
      ),
      this.subscriptionRepo.manager.query(
        `SELECT audience, tier, name FROM plans WHERE id = $1`,
        [newPlanId],
      ),
    ]);

    if (!currentRows.length || !newRows.length) {
      throw new Error('One or both plans not found');
    }

    const current = currentRows[0];
    const next = newRows[0];

    // audience='any' (enterprise_fleet) acepta cualquier origen
    if (next.audience !== 'any' && current.audience !== 'any') {
      if (current.audience !== next.audience) {
        throw new Error(
          `No se puede cambiar de un plan "${current.audience}" a un plan "${next.audience}". ` +
            `Para operar en ambos verticales, selecciona el plan Enterprise Fleet.`,
        );
      }
    }

    const currentTierVal = tierOrder[current.tier] ?? 0;
    const nextTierVal = tierOrder[next.tier] ?? 0;

    if (direction === 'upgrade' && nextTierVal < currentTierVal) {
      throw new Error(
        `El plan "${next.name}" tiene un tier inferior al plan actual. Usa el endpoint de downgrade.`,
      );
    }
    if (direction === 'downgrade' && nextTierVal > currentTierVal) {
      throw new Error(
        `El plan "${next.name}" tiene un tier superior al plan actual. Usa el endpoint de upgrade.`,
      );
    }
  }

  async suspendSubscription(id: string) {
    this.logger.debug(`[suspendSubscription] id: ${id}`);
    // Simulación: suspender la suscripción
    return this.subscriptionRepo.update(id, {
      status: 'suspended',
    });
  }
  // --- Métodos para Addons ---
  async addAddon(subscriptionId: string, addon_type: string, quantity: number) {
    this.logger.debug(
      `[addAddon] subscriptionId: ${subscriptionId}, addon_type: ${addon_type}, quantity: ${quantity}`,
    );
    // Crea un nuevo addon para la suscripción
    const addon = this.addonRepo.create({
      subscription_id: subscriptionId,
      addon_type,
      quantity,
    });
    const saved = await this.addonRepo.save(addon);
    this.logger.debug(`[addAddon] addon creado: ${JSON.stringify(saved)}`);
    return saved;
  }

  async updateAddon(addonId: string, quantity: number) {
    this.logger.debug(
      `[updateAddon] addonId: ${addonId}, quantity: ${quantity}`,
    );
    // Actualiza la cantidad de un addon
    await this.addonRepo.update(addonId, { quantity });
    return this.addonRepo.findOne({ where: { id: addonId } });
  }

  async getAddonsBySubscription(subscriptionId: string) {
    this.logger.debug(
      `[getAddonsBySubscription] subscriptionId: ${subscriptionId}`,
    );
    // Lista todos los addons de una suscripción
    return this.addonRepo.find({ where: { subscription_id: subscriptionId } });
  }

  async getAddonById(addonId: string) {
    this.logger.debug(`[getAddonById] addonId: ${addonId}`);
    // Obtiene un addon por su ID
    return this.addonRepo.findOne({ where: { id: addonId } });
  }

  async removeAddon(addonId: string) {
    this.logger.debug(`[removeAddon] addonId: ${addonId}`);
    // Elimina (soft-delete o hard-delete según política) el addon
    return this.addonRepo.delete(addonId);
  }
}
