import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ReferralConfig } from './entities/referral-config.entity';
import { ReferralLink } from './entities/referral-link.entity';
import { Referral } from './entities/referral.entity';
import { Company } from '../companies/entities/company.entity';
import { UpdateReferralConfigDto } from './dto/update-referral-config.dto';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import type { Subscription } from '../subscriptions/entities/subscription.entity';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectRepository(ReferralConfig)
    private readonly configRepo: Repository<ReferralConfig>,
    @InjectRepository(ReferralLink)
    private readonly linkRepo: Repository<ReferralLink>,
    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  // ─── Config ────────────────────────────────────────────────────────

  async getConfig(): Promise<ReferralConfig> {
    const config = await this.configRepo.findOne({ where: {} });
    if (!config)
      throw new NotFoundException('Configuración de referidos no encontrada');
    return config;
  }

  async updateConfig(
    dto: UpdateReferralConfigDto,
    user: IUserPayload,
  ): Promise<ReferralConfig> {
    const config = await this.getConfig();
    if (dto.referrerDiscountPct !== undefined)
      config.referrerDiscountPct = dto.referrerDiscountPct;
    if (dto.referredDiscountPct !== undefined)
      config.referredDiscountPct = dto.referredDiscountPct;
    if (dto.linkTtlHours !== undefined) config.linkTtlHours = dto.linkTtlHours;
    if (dto.isActive !== undefined) config.isActive = dto.isActive;
    config.updatedBy = user.sub;
    config.updatedAt = new Date();
    return this.configRepo.save(config);
  }

  // ─── Links ─────────────────────────────────────────────────────────

  async generateLink(
    user: IUserPayload,
  ): Promise<ReferralLink & { url: string }> {
    this.assertNotDriver(user);

    const config = await this.getConfig();
    if (!config.isActive) {
      throw new ForbiddenException(
        'El sistema de referidos está temporalmente deshabilitado',
      );
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + config.linkTtlHours * 60 * 60 * 1000,
    );

    const link = this.linkRepo.create({
      companyId: user.companyId!,
      token,
      expiresAt,
      maxUses: 1,
      timesUsed: 0,
      isActive: true,
      createdBy: user.sub,
    });

    const saved = await this.linkRepo.save(link);
    this.logger.log(
      `Link de referido generado: company=${user.companyId} token=${token.slice(0, 8)}...`,
    );

    return { ...saved, url: this.buildUrl(token) };
  }

  async getMyLinks(
    user: IUserPayload,
  ): Promise<Array<ReferralLink & { url: string; referralsCount: number }>> {
    this.assertNotDriver(user);

    const links = await this.linkRepo.find({
      where: { companyId: user.companyId!, isActive: true },
      order: { createdAt: 'DESC' },
    });

    const result = await Promise.all(
      links.map(async (link) => {
        const referralsCount = await this.referralRepo.count({
          where: { referralLinkId: link.id },
        });
        return { ...link, url: this.buildUrl(link.token), referralsCount };
      }),
    );

    return result;
  }

  async deactivateLink(id: string, user: IUserPayload): Promise<void> {
    this.assertNotDriver(user);

    const link = await this.linkRepo.findOne({
      where: { id, companyId: user.companyId! },
    });
    if (!link) throw new NotFoundException('Link de referido no encontrado');

    link.isActive = false;
    await this.linkRepo.save(link);
  }

  // ─── Validación pública ────────────────────────────────────────────

  async validateToken(token: string): Promise<{
    valid: boolean;
    referredDiscountPct: number;
    expiresAt: Date;
    companyId: string;
  }> {
    const link = await this.linkRepo.findOne({
      where: { token, isActive: true },
    });

    if (!link) {
      return {
        valid: false,
        referredDiscountPct: 0,
        expiresAt: new Date(),
        companyId: '',
      };
    }

    const now = new Date();
    if (link.expiresAt < now) {
      return {
        valid: false,
        referredDiscountPct: 0,
        expiresAt: link.expiresAt,
        companyId: '',
      };
    }

    if (link.timesUsed >= link.maxUses) {
      return {
        valid: false,
        referredDiscountPct: 0,
        expiresAt: link.expiresAt,
        companyId: '',
      };
    }

    const config = await this.getConfig();
    return {
      valid: true,
      referredDiscountPct: config.referredDiscountPct,
      expiresAt: link.expiresAt,
      companyId: link.companyId,
    };
  }

  // ─── Estadísticas ──────────────────────────────────────────────────

  async getMyStats(user: IUserPayload): Promise<{
    totalReferrals: number;
    pendingCount: number;
    referredRewardedCount: number;
    completedCount: number;
    activeLinksCount: number;
    hasPendingReward: boolean;
  }> {
    this.assertNotDriver(user);

    const [referrals, activeLinksCount] = await Promise.all([
      this.referralRepo.find({ where: { referrerCompanyId: user.companyId! } }),
      this.linkRepo.count({
        where: { companyId: user.companyId!, isActive: true },
      }),
    ]);

    return {
      totalReferrals: referrals.length,
      pendingCount: referrals.filter((r) => r.status === 'pending').length,
      referredRewardedCount: referrals.filter(
        (r) => r.status === 'referred_rewarded',
      ).length,
      completedCount: referrals.filter((r) => r.status === 'completed').length,
      activeLinksCount,
      hasPendingReward: referrals.some((r) => r.status === 'referred_rewarded'),
    };
  }

  // ─── Uso interno (registro + pagos) ───────────────────────────────

  /**
   * Llamado desde AuthService.register() cuando viene referralToken.
   * Crea el registro en `referrals` y vincula la empresa referida.
   */
  async applyReferralOnRegister(
    token: string,
    referredCompanyId: string,
  ): Promise<void> {
    const link = await this.linkRepo.findOne({
      where: { token, isActive: true },
    });
    if (!link) return;

    const now = new Date();
    if (link.expiresAt < now || link.timesUsed >= link.maxUses) return;

    const alreadyReferred = await this.referralRepo.findOne({
      where: { referredCompanyId },
    });
    if (alreadyReferred) return;

    const config = await this.getConfig();

    await this.referralRepo.save(
      this.referralRepo.create({
        referralLinkId: link.id,
        referrerCompanyId: link.companyId,
        referredCompanyId,
        status: 'pending',
        referrerDiscountPct: config.referrerDiscountPct,
        referredDiscountPct: config.referredDiscountPct,
      }),
    );

    link.timesUsed += 1;
    if (link.timesUsed >= link.maxUses) link.isActive = false;
    await this.linkRepo.save(link);

    await this.companyRepo.update(referredCompanyId, {
      referredByCompanyId: link.companyId,
    });

    this.logger.log(
      `Referral registrado: referrer=${link.companyId} referred=${referredCompanyId}`,
    );
  }

  /**
   * Llamado desde PaymentsService.createCheckout() para aplicar descuento
   * al primer pago del referido. Devuelve el % a descontar (0 si no aplica).
   */
  async getReferredDiscount(companyId: string): Promise<number> {
    const referral = await this.referralRepo.findOne({
      where: { referredCompanyId: companyId, status: 'pending' },
    });
    return referral?.referredDiscountPct ?? 0;
  }

  /**
   * Llamado desde el webhook payment.approved.
   * Marca el referido como recompensado y asigna el descuento al referidor.
   */
  async onReferredPaymentApproved(
    referredCompanyId: string,
    subscriptionRepo: Repository<Subscription>,
  ): Promise<void> {
    const referral = await this.referralRepo.findOne({
      where: { referredCompanyId, status: 'pending' },
    });
    if (!referral) return;

    referral.status = 'referred_rewarded';
    referral.referredRewardedAt = new Date();
    await this.referralRepo.save(referral);

    // Asigna el descuento pendiente al referidor en su suscripción activa
    const referrerSub = await subscriptionRepo.findOne({
      where: { company_id: referral.referrerCompanyId, status: 'active' },
    });
    if (referrerSub) {
      referrerSub.pending_referral_discount_pct = referral.referrerDiscountPct;
      await subscriptionRepo.save(referrerSub);
      this.logger.log(
        `Descuento ${referral.referrerDiscountPct}% asignado al referidor company=${referral.referrerCompanyId}`,
      );
    }
  }

  /**
   * Llamado tras aplicar el descuento al referidor en su renovación.
   * Cierra el ciclo completo del referido.
   */
  async onReferrerRewarded(referrerCompanyId: string): Promise<void> {
    const referral = await this.referralRepo.findOne({
      where: { referrerCompanyId, status: 'referred_rewarded' },
      order: { createdAt: 'DESC' },
    });
    if (!referral) return;

    referral.status = 'completed';
    referral.referrerRewardedAt = new Date();
    await this.referralRepo.save(referral);
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private assertNotDriver(user: IUserPayload): void {
    if (user.role === UserRole.DRIVER) {
      throw new ForbiddenException(
        'Los conductores no pueden acceder al módulo de referidos',
      );
    }
  }

  private buildUrl(token: string): string {
    const base =
      process.env.APP_PUBLIC_URL ??
      process.env.APP_URL ??
      'http://localhost:3000';
    const prefix = process.env.API_PREFIX ?? 'v1';
    return `${base}/${prefix}/referrals/join/${token}`;
  }
}
