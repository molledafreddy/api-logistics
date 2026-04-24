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
import { VerificationStatus } from '../../common/enums/verification-status.enum';
import { CreateVerificationDto, ReviewVerificationDto } from './dto';

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
    return this.verificationRepo.save(v);
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
    } else {
      v.status = VerificationStatus.REJECTED;
      v.rejectedAt = new Date();
      v.rejectionReason = dto.reason || null;
    }

    return this.verificationRepo.save(v);
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
