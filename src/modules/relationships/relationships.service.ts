import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyRelationship } from './entities/company-relationship.entity';
import { CompanyRelationshipLog } from './entities/company-relationship-log.entity';
import { RelationshipStatus } from '../../common/enums/relationship-status.enum';
import {
  CreateRelationshipDto,
  RespondRelationshipDto,
  TerminateRelationshipDto,
} from './dto';
import { randomUUID } from 'crypto';

@Injectable()
export class RelationshipsService {
  private readonly logger = new Logger(RelationshipsService.name);

  constructor(
    @InjectRepository(CompanyRelationship)
    private readonly relationshipRepo: Repository<CompanyRelationship>,
    @InjectRepository(CompanyRelationshipLog)
    private readonly logRepo: Repository<CompanyRelationshipLog>,
  ) {}

  async create(dto: CreateRelationshipDto, invitedBy: string) {
    const rel = this.relationshipRepo.create({
      ...dto,
      invitedBy,
      invitationToken: randomUUID(),
      status: RelationshipStatus.PENDING,
    });
    const saved = await this.relationshipRepo.save(rel);
    await this.addLog(
      saved.id,
      'created',
      null,
      RelationshipStatus.PENDING,
      invitedBy,
    );
    return saved;
  }

  async findByCompany(companyId: string) {
    return this.relationshipRepo.find({
      where: [{ parentCompanyId: companyId }, { childCompanyId: companyId }],
      order: { invitedAt: 'DESC' },
    });
  }

  async findById(id: string) {
    const r = await this.relationshipRepo.findOneBy({ id });
    if (!r) throw new NotFoundException('Relationship not found');
    return r;
  }

  async respond(id: string, dto: RespondRelationshipDto, userId: string) {
    const r = await this.findById(id);
    if (r.status !== RelationshipStatus.PENDING) {
      throw new BadRequestException(
        `Cannot respond to relationship in status ${r.status}`,
      );
    }
    const prev = r.status;
    r.respondedBy = userId;
    if (dto.decision === 'accepted') {
      r.status = RelationshipStatus.ACCEPTED;
      r.acceptedAt = new Date();
    } else {
      r.status = RelationshipStatus.REJECTED;
      r.rejectedAt = new Date();
      r.rejectionReason = dto.reason || null;
    }
    const saved = await this.relationshipRepo.save(r);
    await this.addLog(id, dto.decision, prev, r.status, userId, dto.reason);
    return saved;
  }

  async terminate(id: string, dto: TerminateRelationshipDto, userId: string) {
    const r = await this.findById(id);
    if (r.status !== RelationshipStatus.ACCEPTED) {
      throw new BadRequestException(
        'Only accepted relationships can be terminated',
      );
    }
    const prev = r.status;
    r.status = RelationshipStatus.BLOCKED;
    r.terminatedAt = new Date();
    r.terminatedReason = dto.reason;
    const saved = await this.relationshipRepo.save(r);
    await this.addLog(id, 'terminated', prev, r.status, userId, dto.reason);
    return saved;
  }

  async getLogs(relationshipId: string) {
    return this.logRepo.find({
      where: { relationshipId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Verifica si existe una relación ACTIVA (status=accepted) entre dos empresas.
   * El orden parent/child no importa: busca en ambos sentidos.
   *
   * Útil para validar antes de crear envíos cross-company, mensajería entre
   * empresas, asignaciones compartidas, etc.
   */
  async isActiveBetween(companyA: string, companyB: string): Promise<boolean> {
    if (companyA === companyB) return true; // misma empresa: siempre activa
    const r = await this.relationshipRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: RelationshipStatus.ACCEPTED })
      .andWhere(
        '((r.parentCompanyId = :a AND r.childCompanyId = :b) OR (r.parentCompanyId = :b AND r.childCompanyId = :a))',
        { a: companyA, b: companyB },
      )
      .getOne();
    return !!r;
  }

  private async addLog(
    relationshipId: string,
    action: string,
    fromStatus: RelationshipStatus | null,
    toStatus: RelationshipStatus,
    performedBy: string,
    reason?: string,
  ) {
    return this.logRepo.save(
      this.logRepo.create({
        relationshipId,
        action,
        fromStatus,
        toStatus,
        performedBy,
        reason: reason || null,
      }),
    );
  }
}
