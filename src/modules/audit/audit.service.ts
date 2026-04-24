import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(data: Partial<AuditLog>) {
    try {
      return await this.auditRepo.save(this.auditRepo.create(data));
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }

  async findByCompany(companyId: string, page = 1, limit = 50) {
    return this.auditRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findByResource(entityType: string, entityId: string) {
    return this.auditRepo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }
}
