import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Verification } from './entities/verification.entity';
import { VerificationDocument } from './entities/verification-document.entity';
import { VerificationTier } from './entities/verification-tier.entity';
import { Company } from '../companies/entities/company.entity';
import { User } from '../auth/entities/user.entity';
import { VerificationStatus } from '../../common/enums/verification-status.enum';
import { CompanyStatus } from '../../common/enums/company-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { CreateVerificationDto, ReviewVerificationDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class VerificationsService {
  private readonly logger = new Logger(VerificationsService.name);

  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,
    @InjectRepository(VerificationDocument)
    private readonly documentRepo: Repository<VerificationDocument>,
    @InjectRepository(VerificationTier)
    private readonly tierRepo: Repository<VerificationTier>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Tiers ─────────────────────────────────
  async findAllTiers() {
    return this.tierRepo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });
  }

  async createTier(data: Partial<VerificationTier>) {
    return this.tierRepo.save(this.tierRepo.create(data));
  }

  // ─── Verifications ─────────────────────────
  async create(dto: CreateVerificationDto) {
    const tier = await this.tierRepo.findOneBy({ id: dto.tierId });
    if (!tier) throw new NotFoundException('Verification tier not found');

    const verification = this.verificationRepo.create({
      companyId: dto.companyId,
      tierId: dto.tierId,
      status: VerificationStatus.PENDING,
    });
    return this.verificationRepo.save(verification);
  }

  async findByCompany(companyId: string) {
    return this.verificationRepo.find({
      where: { companyId },
      relations: ['tier', 'documents'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string) {
    const v = await this.verificationRepo.findOne({
      where: { id },
      relations: ['tier', 'documents'],
    });
    if (!v) throw new NotFoundException('Verification not found');
    return v;
  }

  async submit(id: string) {
    const v = await this.findById(id);
    if (v.status !== VerificationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot submit verification in status ${v.status}`,
      );
    }
    v.status = VerificationStatus.IN_REVIEW;
    v.submittedAt = new Date();
    const saved = await this.verificationRepo.save(v);

    // Notify all platform admins that a new verification needs review
    const admins = await this.userRepo.find({
      where: { role: UserRole.SUPER_ADMIN },
      select: ['id'],
    });
    await Promise.all(
      admins.map((admin) =>
        this.notificationsService
          .create({
            userId: admin.id,
            type: NotificationType.VERIFICATION_UPDATE,
            title: 'Nueva verificación para revisar',
            body: `Una empresa ha enviado su documentación y está esperando aprobación.`,
            data: { verificationId: v.id, companyId: v.companyId },
          })
          .catch((err) =>
            this.logger.warn(
              `Failed to notify admin ${admin.id}: ${err.message}`,
            ),
          ),
      ),
    );

    return saved;
  }

  async review(id: string, dto: ReviewVerificationDto, reviewerId: string) {
    const v = await this.findById(id);
    if (v.status !== VerificationStatus.IN_REVIEW) {
      throw new BadRequestException(
        `Cannot review verification in status ${v.status}`,
      );
    }

    v.reviewedBy = reviewerId;
    v.reviewedAt = new Date();
    v.reviewNotes = dto.reviewNotes || null;

    if (dto.decision === 'approved') {
      v.status = VerificationStatus.APPROVED;
      v.approvedAt = new Date();
      if (v.tier) {
        v.expiresAt = new Date(
          Date.now() + v.tier.validityDays * 24 * 60 * 60 * 1000,
        );
      }
      await this.companyRepo.update(v.companyId, {
        status: CompanyStatus.ACTIVE,
      });
      this.logger.log(
        `Company ${v.companyId} activated after verification ${v.id} approved`,
      );
    } else {
      v.status = VerificationStatus.REJECTED;
      v.rejectedAt = new Date();
      v.rejectionReason = dto.reason || null;
    }

    const saved = await this.verificationRepo.save(v);

    // Notify company owner and admins of the result
    const recipients = await this.userRepo.find({
      where: [
        { companyId: v.companyId, role: UserRole.COMPANY_OWNER },
        { companyId: v.companyId, role: UserRole.ADMIN },
      ],
      select: ['id'],
    });

    const isApproved = dto.decision === 'approved';
    await Promise.all(
      recipients.map((user) =>
        this.notificationsService
          .create({
            userId: user.id,
            type: NotificationType.VERIFICATION_UPDATE,
            title: isApproved
              ? '✅ Empresa verificada'
              : '❌ Verificación rechazada',
            body: isApproved
              ? 'Tu empresa ha sido verificada y ya puede operar en la plataforma.'
              : `Tu verificación fue rechazada. Motivo: ${dto.reason ?? 'Sin especificar'}`,
            data: {
              verificationId: v.id,
              companyId: v.companyId,
              decision: dto.decision,
              ...(dto.reason && { reason: dto.reason }),
            },
          })
          .catch((err) =>
            this.logger.warn(
              `Failed to notify user ${user.id}: ${err.message}`,
            ),
          ),
      ),
    );

    return saved;
  }

  // ─── Documents ─────────────────────────────
  async addDocument(
    verificationId: string,
    data: Partial<VerificationDocument>,
  ) {
    const v = await this.findById(verificationId);
    const doc = this.documentRepo.create({ ...data, verificationId: v.id });
    return this.documentRepo.save(doc);
  }

  async findDocuments(verificationId: string) {
    return this.documentRepo.find({ where: { verificationId } });
  }
}
