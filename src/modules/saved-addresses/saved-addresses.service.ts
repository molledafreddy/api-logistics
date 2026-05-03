import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SavedAddress } from './entities/saved-address.entity';
import {
  CreateSavedAddressDto,
  UpdateSavedAddressDto,
  QuerySavedAddressDto,
} from './dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { PaginationResponseDto } from '../../common/dto/pagination-response.dto';

/**
 * Sprint C.5 — SavedAddressesService.
 *
 * Reglas:
 *   SAV-001: Tenancy estricto, salvo SUPER_ADMIN que puede filtrar por companyId.
 *   SAV-002: `label` único por compañía (case-sensitive vía índice parcial).
 *   SAV-003: Soft delete (mantiene auditoría histórica).
 */
@Injectable()
export class SavedAddressesService {
  private readonly logger = new Logger(SavedAddressesService.name);

  constructor(
    @InjectRepository(SavedAddress)
    private readonly repo: Repository<SavedAddress>,
  ) {}

  // ─── Public API ────────────────────────────

  async create(
    dto: CreateSavedAddressDto,
    user: IUserPayload,
  ): Promise<SavedAddress> {
    const companyId = this.requireCompanyId(user);

    const dup = await this.repo.findOne({
      where: { companyId, label: dto.label },
    });
    if (dup) {
      throw new ConflictException(
        `SAV-002: ya existe un favorito con label "${dto.label}" en esta compañía.`,
      );
    }

    const { lat, lng, ...rest } = dto;
    const entity = this.repo.create({
      ...rest,
      companyId,
      createdBy: user.sub ?? null,
      kind: rest.kind ?? 'other',
      // numeric → string para alinear con TypeORM
      lat: String(lat),
      lng: String(lng),
    });

    const saved = await this.repo.save(entity);
    this.logger.log(
      `SavedAddress created: ${saved.label} (${saved.id}) for company ${companyId}`,
    );
    return saved;
  }

  async findAll(
    query: QuerySavedAddressDto,
    user: IUserPayload,
  ): Promise<PaginationResponseDto<SavedAddress>> {
    const qb = this.repo
      .createQueryBuilder('addr')
      .where('addr.deletedAt IS NULL');

    if (user.role === UserRole.SUPER_ADMIN) {
      if (query.companyId) {
        qb.andWhere('addr.companyId = :cid', { cid: query.companyId });
      }
    } else {
      const companyId = this.requireCompanyId(user);
      qb.andWhere('addr.companyId = :cid', { cid: companyId });
    }

    if (query.kind) {
      qb.andWhere('addr.kind = :kind', { kind: query.kind });
    }

    if (query.q) {
      qb.andWhere('(addr.label ILIKE :q OR addr.formatted ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }

    qb.orderBy('addr.label', 'ASC');
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginationResponseDto.create(data, total, query.page, query.limit);
  }

  async findOne(id: string, user: IUserPayload): Promise<SavedAddress> {
    const addr = await this.repo.findOne({ where: { id } });
    if (!addr) {
      throw new NotFoundException(`SavedAddress ${id} not found`);
    }
    this.assertTenantAccess(addr, user);
    return addr;
  }

  async update(
    id: string,
    dto: UpdateSavedAddressDto,
    user: IUserPayload,
  ): Promise<SavedAddress> {
    const addr = await this.findOne(id, user);

    if (dto.label && dto.label !== addr.label) {
      const dup = await this.repo.findOne({
        where: { companyId: addr.companyId, label: dto.label },
      });
      if (dup) {
        throw new ConflictException(
          `SAV-002: ya existe un favorito con label "${dto.label}" en esta compañía.`,
        );
      }
    }

    const { lat, lng, ...rest } = dto;
    const merged = this.repo.merge(addr, {
      ...rest,
      ...(lat !== undefined ? { lat: String(lat) } : {}),
      ...(lng !== undefined ? { lng: String(lng) } : {}),
    });
    const saved = await this.repo.save(merged);
    this.logger.log(`SavedAddress updated: ${saved.id}`);
    return saved;
  }

  async remove(id: string, user: IUserPayload): Promise<void> {
    const addr = await this.findOne(id, user);
    await this.repo.softRemove(addr);
    this.logger.log(`SavedAddress soft-deleted: ${addr.id}`);
  }

  // ─── Helpers ───────────────────────────────

  private requireCompanyId(user: IUserPayload): string {
    if (!user.companyId) {
      throw new ForbiddenException('User has no company associated');
    }
    return user.companyId;
  }

  private assertTenantAccess(addr: SavedAddress, user: IUserPayload): void {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (addr.companyId !== user.companyId) {
      throw new ForbiddenException(
        'SAV-001: no tienes acceso a este favorito.',
      );
    }
  }
}
