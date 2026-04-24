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
  ) {}

  // Métodos CRUD simulados para el sprint
  async createFreeSubscription(companyId: string, planId: string) {
    this.logger.debug(
      `[createFreeSubscription] companyId: ${companyId}, planId: ${planId}`,
    );
    // Lógica para crear suscripción Free
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
    // Simulación: cambiar el plan y reiniciar periodo
    return this.subscriptionRepo.update(id, {
      plan_id: newPlanId,
      status: 'active',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      canceled_at: undefined,
      cancel_at_period_end: false,
    });
  }

  async downgradeSubscription(id: string, newPlanId: string) {
    this.logger.debug(
      `[downgradeSubscription] id: ${id}, newPlanId: ${newPlanId}`,
    );
    // Simulación: cambiar el plan y reiniciar periodo
    return this.subscriptionRepo.update(id, {
      plan_id: newPlanId,
      status: 'active',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      canceled_at: undefined,
      cancel_at_period_end: false,
    });
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
