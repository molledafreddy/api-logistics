import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { User } from '../auth/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { MailService } from '../mail/mail.service';
import {
  BILLING_EVENTS,
  BillingEventPayload,
} from '../subscriptions/billing-events';

// ─── Paleta de colores del app (STATUS_CONFIG + alert banners de billing/index.tsx) ──

/** active → verde */
const BADGE_ACTIVE = {
  label: 'Activo',
  bg: '#f0fdf4',
  border: '#bbf7d0',
  color: '#15803d',
};
/** pending_payment → amarillo */
const BADGE_PENDING = {
  label: 'Pago pendiente',
  bg: '#fffbeb',
  border: '#fde68a',
  color: '#d97706',
};
/** suspended → rojo */
const BADGE_SUSPENDED = {
  label: 'Suspendida',
  bg: '#fef2f2',
  border: '#fecaca',
  color: '#dc2626',
};
/** error de cobro → rojo */
const BADGE_ERROR = {
  label: 'Error de cobro',
  bg: '#fef2f2',
  border: '#fecaca',
  color: '#dc2626',
};

/**
 * Listener de eventos de dominio billing → envía email a owners/admins de la company.
 *
 * Los colores de badges y banners replican exactamente STATUS_CONFIG y los
 * alert banners implementados en mobile-logistics/app/(app)/billing/index.tsx.
 */
@Injectable()
export class BillingMailService {
  private readonly logger = new Logger(BillingMailService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  // ─── Handlers ──────────────────────────────────────────────────────────────

  @OnEvent(BILLING_EVENTS.RENEWAL_SCHEDULED, { async: true })
  async onRenewalScheduled(payload: BillingEventPayload): Promise<void> {
    const periodEnd = this.formatDate(payload.meta?.currentPeriodEnd);
    await this.mailOwners(payload, {
      subject: `Tu plan ${payload.planName} se renueva pronto`,
      preheader: 'Tienes un enlace de pago listo para completar tu renovación.',
      badge: BADGE_ACTIVE,
      infoRows: [{ label: '📅 Próxima renovación', value: periodEnd }],
      ctaLabel: 'Ir a Facturación',
    });
  }

  @OnEvent(BILLING_EVENTS.RENEWAL_FAILED, { async: true })
  async onRenewalFailed(payload: BillingEventPayload): Promise<void> {
    await this.mailOwners(payload, {
      subject: `Problema al generar el cobro de tu plan ${payload.planName}`,
      preheader:
        'No pudimos procesar tu cobro. Ingresa a la app para reintentarlo.',
      badge: BADGE_ERROR,
      alert: {
        bg: '#fef2f2',
        border: '#fecaca',
        iconBg: '#fee2e2',
        icon: '⚠️',
        title: 'No pudimos procesar tu cobro',
        titleColor: '#991b1b',
        body: 'Ingresa a la app y ve a Facturación → Generar enlace de pago para reintentarlo.',
        bodyColor: '#b91c1c',
      },
      ctaLabel: 'Reintentar en la app',
    });
  }

  @OnEvent(BILLING_EVENTS.GRACE_STARTED, { async: true })
  async onGraceStarted(payload: BillingEventPayload): Promise<void> {
    const periodEnd = this.formatDate(payload.meta?.currentPeriodEnd);
    const graceUntil = this.formatDate(payload.meta?.gracePeriodUntil);
    await this.mailOwners(payload, {
      subject: `Pago pendiente — tu plan ${payload.planName} vence el ${graceUntil}`,
      preheader: `Tienes hasta el ${graceUntil} para pagar antes de que tu cuenta sea suspendida.`,
      badge: BADGE_PENDING,
      infoRows: [
        { label: '📅 Período venció', value: periodEnd, valueColor: '#d97706' },
        { label: '⏳ Gracia hasta', value: graceUntil, valueColor: '#d97706' },
      ],
      alert: {
        bg: '#fffbeb',
        border: '#fde68a',
        iconBg: '#fef3c7',
        icon: '⏳',
        title: 'Completa el pago para mantener el servicio activo',
        titleColor: '#92400e',
        body: `Tienes hasta el ${graceUntil} para regularizar el pago. Tus datos están seguros.`,
        bodyColor: '#b45309',
      },
      ctaLabel: 'Pagar ahora',
    });
  }

  @OnEvent(BILLING_EVENTS.GRACE_ENDING, { async: true })
  async onGraceEnding(payload: BillingEventPayload): Promise<void> {
    const graceUntil = this.formatDate(payload.meta?.gracePeriodUntil);
    await this.mailOwners(payload, {
      subject: `⚠️ Tu cuenta se suspende mañana — plan ${payload.planName}`,
      preheader:
        'Última oportunidad para pagar antes de la suspensión automática.',
      badge: BADGE_PENDING,
      infoRows: [
        { label: '⏳ Gracia vence', value: graceUntil, valueColor: '#f97316' },
      ],
      alert: {
        bg: '#fff7ed',
        border: '#fed7aa',
        iconBg: '#ffedd5',
        icon: '🚨',
        title: 'Tu cuenta se suspende en menos de 24 horas',
        titleColor: '#9a3412',
        body: 'Si no completas el pago antes de que expire la gracia, tu cuenta quedará suspendida y tus operaciones se detendrán.',
        bodyColor: '#c2410c',
      },
      ctaLabel: 'Pagar ahora — última oportunidad',
    });
  }

  @OnEvent(BILLING_EVENTS.SUBSCRIPTION_SUSPENDED, { async: true })
  async onSuspended(payload: BillingEventPayload): Promise<void> {
    const suspendedAt = this.formatDate(
      payload.meta?.suspendedAt ?? payload.meta?.gracePeriodUntil,
    );
    await this.mailOwners(payload, {
      subject: `Tu cuenta fue suspendida — plan ${payload.planName}`,
      preheader: 'Reactiva tu cuenta completando el pago desde la app.',
      badge: BADGE_SUSPENDED,
      infoRows: [
        {
          label: '📅 Suspendida el',
          value: suspendedAt,
          valueColor: '#dc2626',
        },
      ],
      alert: {
        bg: '#fef2f2',
        border: '#fecaca',
        iconBg: '#fee2e2',
        icon: '🔒',
        title: 'Servicio suspendido',
        titleColor: '#991b1b',
        body: 'Tu plan fue suspendido por falta de pago. Tus datos están seguros; reactívalo cuando quieras desde Facturación.',
        bodyColor: '#b91c1c',
      },
      ctaLabel: 'Reactivar mi cuenta',
    });
  }

  @OnEvent(BILLING_EVENTS.SUBSCRIPTION_REACTIVATED, { async: true })
  async onReactivated(payload: BillingEventPayload): Promise<void> {
    const periodEnd = this.formatDate(payload.meta?.currentPeriodEnd);
    await this.mailOwners(payload, {
      subject: `✅ Tu plan ${payload.planName} está activo nuevamente`,
      preheader: 'Recibimos tu pago. Tu servicio continúa sin interrupciones.',
      badge: BADGE_ACTIVE,
      infoRows:
        periodEnd !== 'sin fecha'
          ? [
              {
                label: '📅 Nuevo período hasta',
                value: periodEnd,
                valueColor: '#16a34a',
              },
            ]
          : undefined,
      alert: {
        bg: '#f0fdf4',
        border: '#bbf7d0',
        iconBg: '#dcfce7',
        icon: '✅',
        title: '¡Pago recibido!',
        titleColor: '#15803d',
        body: `Recibimos tu pago correctamente. Tu plan ${payload.planName} sigue activo sin interrupciones.`,
        bodyColor: '#16a34a',
      },
      ctaLabel: 'Ir a la app',
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async mailOwners(
    payload: BillingEventPayload,
    opts: Omit<
      Parameters<MailService['sendBillingEmail']>[0],
      'to' | 'planName'
    >,
  ): Promise<void> {
    try {
      const recipients = await this.userRepo.find({
        where: {
          companyId: payload.companyId,
          role: In([UserRole.COMPANY_OWNER, UserRole.ADMIN]),
        },
        select: ['id', 'email'],
      });

      if (recipients.length === 0) {
        this.logger.warn(
          `billing email sub=${payload.subscriptionId} sin destinatarios (company=${payload.companyId})`,
        );
        return;
      }

      await Promise.allSettled(
        recipients.map((u) =>
          this.mailService.sendBillingEmail({
            to: u.email,
            planName: payload.planName,
            ...opts,
          }),
        ),
      );

      this.logger.log(
        `billing email "${opts.subject}" enviado a ${recipients.length} destinatario(s) company=${payload.companyId}`,
      );
    } catch (err) {
      this.logger.error(
        `billing mail failed sub=${payload.subscriptionId}: ${(err as Error).message}`,
      );
    }
  }

  private formatDate(iso: string | undefined): string {
    if (!iso) return 'sin fecha';
    try {
      return new Date(iso).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  }
}
