import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, DataSource } from 'typeorm';
import { Truck } from './entities/truck.entity';
import { CreateTruckDto, UpdateTruckDto, QueryTruckDto } from './dto';
import { TruckStatus } from '../../common/enums/truck-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { requireCompanyId } from '../../common/helpers/tenant.helpers';
import { PaginationResponseDto } from '../../common/dto/pagination-response.dto';

const FREE_PLAN_MAX_TRUCKS = 1;

@Injectable()
export class TrucksService {
  private readonly logger = new Logger(TrucksService.name);

  constructor(
    @InjectRepository(Truck)
    private readonly truckRepository: Repository<Truck>,
    private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async create(dto: CreateTruckDto, user: IUserPayload): Promise<Truck> {
    const companyId = requireCompanyId(user);

    if (user.role !== UserRole.SUPER_ADMIN) {
      await this.checkTruckPlanLimit(companyId);
    }

    // Verifica unicidad de placa por empresa
    const existing = await this.truckRepository.findOne({
      where: { companyId, plate: dto.plate },
    });
    if (existing) {
      throw new ConflictException(
        `Truck with plate "${dto.plate}" already exists in this company`,
      );
    }

    // Si se intenta crear el truck ya con un driver asignado,
    // verificar que ese driver no esté en otro truck activo de la empresa.
    if (dto.currentDriverId) {
      const conflict = await this.truckRepository.findOne({
        where: { companyId, currentDriverId: dto.currentDriverId },
        select: ['id', 'plate'],
      });
      if (conflict) {
        throw new ConflictException(
          `Driver ${dto.currentDriverId} is already assigned to truck "${conflict.plate}" (${conflict.id}). Unassign it first.`,
        );
      }
    }

    const truck = this.truckRepository.create({
      ...dto,
      companyId,
      status: dto.status || TruckStatus.AVAILABLE,
    });

    const saved = await this.truckRepository.save(truck);
    this.logger.log(`Truck created: ${saved.plate} (${saved.id})`);
    return saved;
  }

  // ─────────────────────────────────────────────
  // FIND ALL (paginado, filtrado por tenant)
  // ─────────────────────────────────────────────
  async findAll(
    query: QueryTruckDto,
    user: IUserPayload,
  ): Promise<PaginationResponseDto<Truck>> {
    const qb = this.truckRepository
      .createQueryBuilder('truck')
      .where('truck.deletedAt IS NULL');

    // Filtro multi-tenant
    if (user.role === UserRole.SUPER_ADMIN) {
      if (query.companyId) {
        qb.andWhere('truck.companyId = :companyId', {
          companyId: query.companyId,
        });
      }
    } else {
      const companyId = requireCompanyId(user);
      qb.andWhere('truck.companyId = :companyId', { companyId });
    }

    if (query.search) {
      qb.andWhere(
        '(truck.plate ILIKE :search OR truck.make ILIKE :search OR truck.model ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.status) {
      qb.andWhere('truck.status = :status', { status: query.status });
    }
    if (query.type) {
      qb.andWhere('truck.type = :type', { type: query.type });
    }
    if (query.driverId) {
      qb.andWhere('truck.currentDriverId = :driverId', {
        driverId: query.driverId,
      });
    }

    const allowedSort = [
      'plate',
      'status',
      'type',
      'year',
      'createdAt',
      'updatedAt',
    ];
    const sortBy = allowedSort.includes(query.sortBy || '')
      ? `truck.${query.sortBy}`
      : 'truck.createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortBy, sortOrder);

    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginationResponseDto.create(data, total, query.page, query.limit);
  }

  // ─────────────────────────────────────────────
  // FIND ONE
  // ─────────────────────────────────────────────
  async findOne(id: string, user: IUserPayload): Promise<Truck> {
    const truck = await this.truckRepository.findOne({ where: { id } });
    if (!truck) {
      throw new NotFoundException(`Truck ${id} not found`);
    }
    this.assertTenantAccess(truck, user);
    return truck;
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateTruckDto,
    user: IUserPayload,
  ): Promise<Truck> {
    const truck = await this.findOne(id, user);

    // Si cambia la placa, verificar unicidad
    if (dto.plate && dto.plate !== truck.plate) {
      const dup = await this.truckRepository.findOne({
        where: { companyId: truck.companyId, plate: dto.plate },
      });
      if (dup) {
        throw new ConflictException(
          `Truck with plate "${dto.plate}" already exists in this company`,
        );
      }
    }

    Object.assign(truck, dto);
    const saved = await this.truckRepository.save(truck);
    this.logger.log(`Truck updated: ${saved.plate} (${saved.id})`);
    return saved;
  }

  // ─────────────────────────────────────────────
  // UPDATE STATUS
  // ─────────────────────────────────────────────
  async updateStatus(
    id: string,
    status: TruckStatus,
    user: IUserPayload,
  ): Promise<Truck> {
    const truck = await this.findOne(id, user);
    truck.status = status;
    const saved = await this.truckRepository.save(truck);
    this.logger.log(`Truck ${saved.plate} status -> ${status}`);
    return saved;
  }

  // ─────────────────────────────────────────────
  // ASSIGN / UNASSIGN DRIVER
  // ─────────────────────────────────────────────
  async assignDriver(
    id: string,
    driverId: string,
    user: IUserPayload,
  ): Promise<Truck> {
    const truck = await this.findOne(id, user);

    if (truck.status === TruckStatus.OUT_OF_SERVICE) {
      throw new BadRequestException(
        'Cannot assign driver to a truck that is out of service',
      );
    }

    // Idempotencia: si ya está asignado al mismo driver, no hacer nada
    if (truck.currentDriverId === driverId) {
      return truck;
    }

    // Regla de negocio: un driver solo puede estar en UN truck activo a la vez
    // (dentro de la misma empresa). Buscar otro truck (≠ este) que ya lo tenga.
    const conflict = await this.truckRepository.findOne({
      where: {
        companyId: truck.companyId,
        currentDriverId: driverId,
        id: Not(truck.id),
      },
      select: ['id', 'plate'],
    });
    if (conflict) {
      throw new ConflictException(
        `Driver ${driverId} is already assigned to truck "${conflict.plate}" (${conflict.id}). Unassign it first.`,
      );
    }

    truck.currentDriverId = driverId;
    const saved = await this.truckRepository.save(truck);
    this.logger.log(`Driver ${driverId} assigned to truck ${saved.plate}`);
    return saved;
  }

  async unassignDriver(id: string, user: IUserPayload): Promise<Truck> {
    const truck = await this.findOne(id, user);
    truck.currentDriverId = null;
    const saved = await this.truckRepository.save(truck);
    this.logger.log(`Driver unassigned from truck ${saved.plate}`);
    return saved;
  }

  // ─────────────────────────────────────────────
  // GET LOCATION (último punto telemétrico)
  // ─────────────────────────────────────────────
  async getLocation(id: string, user: IUserPayload) {
    const truck = await this.findOne(id, user);
    return {
      truckId: truck.id,
      plate: truck.plate,
      lat: truck.lastLat ? Number(truck.lastLat) : null,
      lng: truck.lastLng ? Number(truck.lastLng) : null,
      capturedAt: truck.lastLocationAt,
      status: truck.status,
    };
  }

  // ─────────────────────────────────────────────
  // SOFT DELETE
  // ─────────────────────────────────────────────
  async remove(id: string, user: IUserPayload): Promise<void> {
    const truck = await this.findOne(id, user);

    if (truck.status === TruckStatus.IN_TRANSIT) {
      throw new BadRequestException(
        'Cannot delete a truck that is currently in transit',
      );
    }

    await this.truckRepository.softRemove(truck);
    this.logger.log(`Truck soft-deleted: ${truck.plate} (${truck.id})`);
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  private assertTenantAccess(truck: Truck, user: IUserPayload): void {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (truck.companyId !== user.companyId) {
      throw new ForbiddenException('You do not have access to this truck');
    }
  }

  /**
   * Verifica el límite de trucks según el plan activo de la empresa.
   * - Sin suscripción activa → aplica FREE_PLAN_MAX_TRUCKS como fallback.
   * - Con suscripción activa → lee trucking.max_trucks del jsonb del plan.
   *   Si el plan no define max_trucks, considera el límite ilimitado.
   * - Valor 99999 se trata como ilimitado (sentinel del seed enterprise).
   */
  private async checkTruckPlanLimit(companyId: string): Promise<void> {
    const rows: Array<{ limits: Record<string, Record<string, number>> }> =
      await this.dataSource.query(
        `SELECT p.limits
           FROM subscriptions s
           JOIN plans p ON p.id = s.plan_id
          WHERE s.company_id = $1 AND s.status IN ('active', 'pending_payment')
          ORDER BY s.created_at DESC
          LIMIT 1`,
        [companyId],
      );

    let maxTrucks: number;

    if (rows.length === 0) {
      maxTrucks = FREE_PLAN_MAX_TRUCKS;
    } else {
      const limits = rows[0].limits ?? {};
      const resolved =
        limits['trucking']?.['max_trucks'] ?? limits['global']?.['max_trucks'];

      if (resolved === undefined || resolved === -1 || resolved >= 99999) {
        return; // ilimitado
      }
      maxTrucks = resolved;
    }

    const currentCount = await this.truckRepository.count({
      where: { companyId },
    });

    if (currentCount >= maxTrucks) {
      throw new ForbiddenException(
        `Has alcanzado el límite de ${maxTrucks} vehículo(s) en tu plan actual. Considera mejorar tu plan.`,
      );
    }
  }
}
