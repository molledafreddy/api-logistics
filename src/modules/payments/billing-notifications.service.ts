import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { User } from '../auth/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BILLING_EVENTS,
  BillingEventPayload,
} from '../subscriptions/billing-events';

/**
 * Sprint F.2 — BillingNotificationsService.
 *
 * Listener de eventos de dominio billing → crea Notification (push + WS)
 * para todos los usuarios con rol `company_owner` o `admin` de la company.
 *
 * Notificaciones:
 *   - RENEWAL_SCHEDULED       → "Tu plan se renueva en breve. Pago listo."
 *   - GRACE_STARTED           → "Tu pago no se procesó. Tienes 7 días para pagar."
 *   - GRACE_ENDING            → "⚠️ Mañana se suspende tu cuenta. Paga ahora."
 *   - SUBSCRIPTION_SUSPENDED  → "Tu cuenta fue suspendida por falta de pago."
 *   - SUBSCRIPTION_REACTIVATED→ "✅ Tu plan está activo nuevamente."
 *   - RENEWAL_FAILED          → "No pudimos generar tu cobro. Reintenta."
 *
 * Reusa `NotificationType.SUBSCRIPTION_ALERT` (no requiere migration de enum).
 */
@Injectable()
export class BillingNotificationsService {
  private readonly logger = new Logger(BillingNotificationsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(BILLING_EVENTS.RENEWAL_SCHEDULED, { async: true })
  async onRenewalScheduled(payload: BillingEventPayload): Promise<void> {
    await this.notifyOwners(payload, {
      title: 'Renovación de tu plan lista',
      body: `Tu plan ${payload.planName} se renovará pronto. Si tu cobro automático falla podrás pagar desde la app.`,
      actionUrl: '/billing',
    });
  }

  @OnEvent(BILLING_EVENTS.RENEWAL_FAILED, { async: true })
  async onRenewalFailed(payload: BillingEventPayload): Promise<void> {
    await this.notifyOwners(payload, {
      title: 'No pudimos procesar tu cobro',
      body: `Hubo un problema al generar el cobro de tu plan ${payload.planName}. Intenta de nuevo desde la sección de facturación.`,
      actionUrl: '/billing',
    });
  }

  @OnEvent(BILLING_EVENTS.GRACE_STARTED, { async: true })
  async onGraceStarted(payload: BillingEventPayload): Promise<void> {
    const until = payload.meta?.gracePeriodUntil;
    await this.notifyOwners(payload, {
      title: 'Tu pago no se procesó',
      body: `Tienes hasta ${this.formatDate(until)} para regularizar el pago de tu plan ${payload.planName}. Después tu cuenta será suspendida.`,
      actionUrl: '/billing',
    });
  }

  @OnEvent(BILLING_EVENTS.GRACE_ENDING, { async: true })
  async onGraceEnding(payload: BillingEventPayload): Promise<void> {
    await this.notifyOwners(payload, {
      title: '⚠️ Tu cuenta se suspende mañana',
      body: `Tu plan ${payload.planName} se suspenderá en menos de 24 horas si no completas el pago.`,
      actionUrl: '/billing',
    });
  }

  @OnEvent(BILLING_EVENTS.SUBSCRIPTION_SUSPENDED, { async: true })
  async onSuspended(payload: BillingEventPayload): Promise<void> {
    await this.notifyOwners(payload, {
      title: 'Tu cuenta fue suspendida',
      body: `Tu plan ${payload.planName} fue suspendido por falta de pago. Reactívalo cuando quieras desde facturación; tus datos están seguros.`,
      actionUrl: '/billing',
    });
  }

  @OnEvent(BILLING_EVENTS.SUBSCRIPTION_REACTIVATED, { async: true })
  async onReactivated(payload: BillingEventPayload): Promise<void> {
    await this.notifyOwners(payload, {
      title: '✅ Tu plan está activo nuevamente',
      body: `Recibimos tu pago. Tu plan ${payload.planName} sigue activo sin interrupciones.`,
      actionUrl: '/billing',
    });
  }

  // ─── Helpers ───────────────────────────────

  private async notifyOwners(
    payload: BillingEventPayload,
    msg: { title: string; body: string; actionUrl?: string },
  ): Promise<void> {
    try {
      const recipients = await this.userRepo.find({
        where: {
          companyId: payload.companyId,
          role: In([UserRole.COMPANY_OWNER, UserRole.ADMIN]),
        },
        select: ['id'],
      });

      if (recipients.length === 0) {
        this.logger.warn(
          `billing event sub=${payload.subscriptionId} sin destinatarios (company=${payload.companyId})`,
        );
        return;
      }

      await Promise.all(
        recipients.map((u) =>
          this.notifications.create({
            userId: u.id,
            type: NotificationType.SUBSCRIPTION_ALERT,
            title: msg.title,
            body: msg.body,
            data: {
              subscriptionId: payload.subscriptionId,
              companyId: payload.companyId,
              planName: payload.planName,
              actionUrl: msg.actionUrl,
              ...payload.meta,
            },
          }),
        ),
      );

      this.logger.log(
        `billing notification sent sub=${payload.subscriptionId} recipients=${recipients.length}`,
      );
    } catch (err) {
      // No reventamos el handler — el evento de dominio sigue siendo válido
      // aunque la notificación falle.
      this.logger.error(
        `billing notify failed sub=${payload.subscriptionId}: ${(err as Error).message}`,
      );
    }
  }

  private formatDate(iso: string | undefined): string {
    if (!iso) return 'el final del periodo de gracia';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  }
}
