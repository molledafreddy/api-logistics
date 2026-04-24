import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, Not } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { RecurringTemplate } from './entities/recurring-template.entity';
import { DeliveryRun } from '../delivery-runs/entities/delivery-run.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { Truck } from '../trucks/entities/truck.entity';
import { Driver } from '../drivers/entities/driver.entity';

import {
  CreateRecurringTemplateDto,
  UpdateRecurringTemplateDto,
  QueryRecurringTemplateDto,
} from './dto';

import { RecurrencePattern } from '../../common/enums/recurrence-pattern.enum';
import { DeliveryRunStatus } from '../../common/enums/delivery-run-status.enum';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { PaginationResponseDto } from '../../common/dto/pagination-response.dto';
import { INTERNAL_EVENTS } from '../../gateways/events/internal.events';

export interface GenerationResult {
  templateId: string;
  date: string;
  runId: string;
  shipmentIds: string[];
  /** true si ya existía y no se creó nada (idempotencia RT-002). */
  skipped: boolean;
  /** Razón si skipped=true: 'exception' | 'pattern_mismatch' | 'paused' | 'already_generated' | 'out_of_range'. */
  skipReason?: string;
}

/**
 * RecurringTemplatesService — Plantillas de generación automática (PARTE 7 · sección 30).
 *
 * Reglas de negocio implementadas:
 *   RT-001  solo carrier company puede crear plantillas (no customer)
 *   RT-002  generación idempotente — re-ejecutar el mismo (template, fecha) no duplica
 *   RT-003  modificar `shipmentTemplates` solo afecta runs futuros
 *   RT-004  pause/resume detiene/reanuda la generación (preserva runs históricos)
 *   RT-005  soft delete preserva runs ya generados (auditoría)
 */
@Injectable()
export class RecurringTemplatesService {
  private readonly logger = new Logger(RecurringTemplatesService.name);

  constructor(
    @InjectRepository(RecurringTemplate)
    private readonly templateRepo: Repository<RecurringTemplate>,
    @InjectRepository(DeliveryRun)
    private readonly runRepo: Repository<DeliveryRun>,
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    @InjectRepository(Truck)
    private readonly truckRepo: Repository<Truck>,
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════
  async create(
    dto: CreateRecurringTemplateDto,
    user: IUserPayload,
  ): Promise<RecurringTemplate> {
    const companyId = this.requireCompanyId(user);
    this.assertManagerRole(user);

    if (dto.pattern === RecurrencePattern.WEEKLY && !dto.daysOfWeek?.length) {
      throw new BadRequestException(
        'daysOfWeek is required when pattern=weekly',
      );
    }
    if (dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException('endDate must be >= startDate');
    }

    if (dto.driverId || dto.truckId) {
      await this.validateResourcesBelongToCarrier(
        companyId,
        dto.truckId ?? null,
        dto.driverId ?? null,
      );
    }

    const tpl = this.templateRepo.create({
      companyId,
      name: dto.name,
      pattern: dto.pattern,
      daysOfWeek: dto.daysOfWeek ?? [],
      time: dto.time,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      exceptions: dto.exceptions ?? [],
      driverId: dto.driverId ?? null,
      truckId: dto.truckId ?? null,
      routeId: dto.routeId ?? null,
      shipmentTemplates: dto.shipmentTemplates,
      active: true,
    });
    return this.templateRepo.save(tpl);
  }

  // ═══════════════════════════════════════════════════════════
  // LIST con filtros + paginación
  // ═══════════════════════════════════════════════════════════
  async findAll(
    query: QueryRecurringTemplateDto,
    user: IUserPayload,
  ): Promise<PaginationResponseDto<RecurringTemplate>> {
    const qb = this.templateRepo.createQueryBuilder('tpl');

    if (user.role !== UserRole.SUPER_ADMIN) {
      const companyId = this.requireCompanyId(user);
      qb.andWhere('tpl.companyId = :companyId', { companyId });
    }

    if (query.active !== undefined) {
      qb.andWhere('tpl.active = :active', { active: query.active === 'true' });
    }
    if (query.pattern) {
      qb.andWhere('tpl.pattern = :pattern', { pattern: query.pattern });
    }

    const allowedSort = ['createdAt', 'name', 'startDate', 'lastGeneratedAt'];
    const sortBy = allowedSort.includes(query.sortBy || '')
      ? `tpl.${query.sortBy}`
      : 'tpl.createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortBy, sortOrder);
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginationResponseDto.create(data, total, query.page, query.limit);
  }

  async findOne(id: string, user: IUserPayload): Promise<RecurringTemplate> {
    const tpl = await this.templateRepo.findOne({ where: { id } });
    if (!tpl) throw new NotFoundException(`RecurringTemplate ${id} not found`);
    this.assertTenantAccess(tpl, user);
    return tpl;
  }

  // ═══════════════════════════════════════════════════════════
  // UPDATE — RT-003 (no afecta runs ya generados)
  // ═══════════════════════════════════════════════════════════
  async update(
    id: string,
    dto: UpdateRecurringTemplateDto,
    user: IUserPayload,
  ): Promise<RecurringTemplate> {
    const tpl = await this.findOne(id, user);
    this.assertManagerRole(user);

    if (dto.endDate && dto.startDate && dto.endDate < dto.startDate) {
      throw new BadRequestException('endDate must be >= startDate');
    }
    if (
      (dto.pattern ?? tpl.pattern) === RecurrencePattern.WEEKLY &&
      dto.daysOfWeek &&
      dto.daysOfWeek.length === 0
    ) {
      throw new BadRequestException('weekly pattern requires daysOfWeek');
    }

    if (dto.driverId || dto.truckId) {
      await this.validateResourcesBelongToCarrier(
        tpl.companyId,
        dto.truckId ?? tpl.truckId,
        dto.driverId ?? tpl.driverId,
      );
    }

    Object.assign(tpl, {
      name: dto.name ?? tpl.name,
      pattern: dto.pattern ?? tpl.pattern,
      daysOfWeek: dto.daysOfWeek ?? tpl.daysOfWeek,
      time: dto.time ?? tpl.time,
      startDate: dto.startDate ?? tpl.startDate,
      endDate: dto.endDate ?? tpl.endDate,
      exceptions: dto.exceptions ?? tpl.exceptions,
      driverId: dto.driverId ?? tpl.driverId,
      truckId: dto.truckId ?? tpl.truckId,
      routeId: dto.routeId ?? tpl.routeId,
      shipmentTemplates: dto.shipmentTemplates ?? tpl.shipmentTemplates,
    });

    return this.templateRepo.save(tpl);
  }

  // ═══════════════════════════════════════════════════════════
  // PAUSE / RESUME — RT-004
  // ═══════════════════════════════════════════════════════════
  async pause(id: string, user: IUserPayload): Promise<RecurringTemplate> {
    const tpl = await this.findOne(id, user);
    this.assertManagerRole(user);
    tpl.active = false;
    return this.templateRepo.save(tpl);
  }

  async resume(id: string, user: IUserPayload): Promise<RecurringTemplate> {
    const tpl = await this.findOne(id, user);
    this.assertManagerRole(user);
    tpl.active = true;
    return this.templateRepo.save(tpl);
  }

  // ═══════════════════════════════════════════════════════════
  // SOFT DELETE — RT-005
  // ═══════════════════════════════════════════════════════════
  async remove(id: string, user: IUserPayload): Promise<{ deleted: true }> {
    const tpl = await this.findOne(id, user);
    this.assertManagerRole(user);
    await this.templateRepo.softRemove(tpl);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════
  // GENERATE (manual + cron) — RT-002 idempotente
  // ═══════════════════════════════════════════════════════════
  async generateForDate(
    templateId: string,
    dateISO: string,
    user?: IUserPayload,
  ): Promise<GenerationResult> {
    const tpl = await this.templateRepo.findOne({ where: { id: templateId } });
    if (!tpl)
      throw new NotFoundException(`RecurringTemplate ${templateId} not found`);
    if (user) this.assertTenantAccess(tpl, user);

    // Validaciones de aplicabilidad (no abortan el manual; lo retornan como skipped)
    const skipReason = this.evaluateSkip(tpl, dateISO);
    if (skipReason) {
      this.logger.log(
        `Skipping generation tpl=${templateId} date=${dateISO} reason=${skipReason}`,
      );
      // Si ya existe, devolver el existente para informar al caller
      if (skipReason === 'already_generated') {
        const existing = await this.runRepo.findOne({
          where: {
            recurringTemplateId: tpl.id,
            scheduledDate: dateISO,
            status: Not(DeliveryRunStatus.CANCELLED),
          },
        });
        if (existing) {
          const ships = await this.shipmentRepo.find({
            where: { deliveryRunId: existing.id },
            select: ['id'],
          });
          return {
            templateId: tpl.id,
            date: dateISO,
            runId: existing.id,
            shipmentIds: ships.map((s) => s.id),
            skipped: true,
            skipReason,
          };
        }
      }
      return {
        templateId: tpl.id,
        date: dateISO,
        runId: '',
        shipmentIds: [],
        skipped: true,
        skipReason,
      };
    }

    // Generación dentro de transacción
    const result = await this.dataSource.transaction(async (em) => {
      // Doble check transaccional + el unique partial index garantiza idempotencia a nivel BD
      const existing = await em.findOne(DeliveryRun, {
        where: {
          recurringTemplateId: tpl.id,
          scheduledDate: dateISO,
          status: Not(DeliveryRunStatus.CANCELLED),
        },
      });
      if (existing) {
        const ships = await em.find(Shipment, {
          where: { deliveryRunId: existing.id },
          select: ['id'],
        });
        return {
          templateId: tpl.id,
          date: dateISO,
          runId: existing.id,
          shipmentIds: ships.map((s) => s.id),
          skipped: true,
          skipReason: 'already_generated',
        } as GenerationResult;
      }

      // 1. Crear DeliveryRun
      const run = em.create(DeliveryRun, {
        companyId: tpl.companyId,
        name: `${tpl.name} · ${dateISO}`,
        scheduledDate: dateISO,
        shift: this.inferShift(tpl.time),
        startTime: tpl.time,
        driverId: tpl.driverId,
        truckId: tpl.truckId,
        routeId: tpl.routeId,
        status: DeliveryRunStatus.PLANNED,
        optimizedSequence: [],
        totalStops: 0,
        completedStops: 0,
        recurringTemplateId: tpl.id,
        metadata: { generatedBy: 'recurring-template', templateId: tpl.id },
      });
      let savedRun: DeliveryRun;
      try {
        savedRun = await em.save(run);
      } catch (err) {
        // Race condition con el unique partial index → trato como skipped
        if (this.isUniqueViolation(err)) {
          throw new ConflictException(
            `Race: another worker generated tpl=${tpl.id} date=${dateISO}`,
          );
        }
        throw err;
      }

      // 2. Crear N Shipments + vincular al run
      const shipmentIds: string[] = [];
      const sequence: string[] = [];
      let pos = 1;

      for (const snap of tpl.shipmentTemplates) {
        const trackingCode = await this.generateTrackingCode(em, tpl.companyId);
        const sh = em.create(Shipment, {
          companyId: tpl.companyId,
          customerCompanyId: snap.customerCompanyId ?? null,
          trackingCode,
          status: ShipmentStatus.CONFIRMED,
          priority: 'normal',
          routeId: tpl.routeId,
          truckId: tpl.truckId,
          driverId: tpl.driverId,
          deliveryRunId: savedRun.id,
          runSequence: pos,
          originAddress: snap.originAddress,
          originLat: snap.originLat ?? null,
          originLng: snap.originLng ?? null,
          destinationAddress: snap.destinationAddress,
          destinationLat: snap.destinationLat ?? null,
          destinationLng: snap.destinationLng ?? null,
          description: snap.description,
          cargoType: snap.cargoType,
          weightKg: snap.weightKg ?? null,
          volumeM3: snap.volumeM3 ?? null,
          pieces: snap.pieces ?? null,
          currency: 'USD',
          metadata: snap.metadata ?? {},
        });
        const savedSh = await em.save(sh);
        shipmentIds.push(savedSh.id);
        sequence.push(savedSh.id);
        pos++;
      }

      // 3. Actualizar run con secuencia + métricas
      savedRun.optimizedSequence = sequence;
      savedRun.totalStops = sequence.length;
      // Auto-promoción a READY si tiene driver+truck
      if (savedRun.driverId && savedRun.truckId && savedRun.totalStops > 0) {
        savedRun.status = DeliveryRunStatus.READY;
      }
      await em.save(savedRun);

      // 4. Actualizar lastGeneratedAt
      tpl.lastGeneratedAt = new Date();
      await em.save(tpl);

      return {
        templateId: tpl.id,
        date: dateISO,
        runId: savedRun.id,
        shipmentIds,
        skipped: false,
      } as GenerationResult;
    });

    if (!result.skipped) {
      this.eventEmitter.emit(INTERNAL_EVENTS.RECURRING_GENERATED, {
        templateId: result.templateId,
        runId: result.runId,
        shipmentIds: result.shipmentIds,
        date: result.date,
        companyId: tpl.companyId,
      });
      this.logger.log(
        `Generated tpl=${result.templateId} date=${dateISO} run=${result.runId} ships=${result.shipmentIds.length}`,
      );
    }
    return result;
  }

  /**
   * Lista plantillas activas que aplican para una fecha (uso del cron).
   * Filtra por pattern + active + ventana startDate..endDate + exceptions.
   */
  async listDueForDate(dateISO: string): Promise<RecurringTemplate[]> {
    const candidates = await this.templateRepo
      .createQueryBuilder('tpl')
      .where('tpl.active = true')
      .andWhere('tpl.deletedAt IS NULL')
      .andWhere('tpl.pattern <> :custom', { custom: RecurrencePattern.CUSTOM })
      .andWhere('tpl.startDate <= :date', { date: dateISO })
      .andWhere('(tpl.endDate IS NULL OR tpl.endDate >= :date)', {
        date: dateISO,
      })
      .getMany();
    // Refinar en memoria (daysOfWeek + monthly day + exceptions)
    return candidates.filter((t) => t.appliesTo(dateISO));
  }

  // ═══════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════
  private evaluateSkip(tpl: RecurringTemplate, dateISO: string): string | null {
    if (!tpl.active) return 'paused';
    if (dateISO < tpl.startDate) return 'out_of_range';
    if (tpl.endDate && dateISO > tpl.endDate) return 'out_of_range';
    if (tpl.exceptions?.includes(dateISO)) return 'exception';
    if (tpl.pattern === RecurrencePattern.CUSTOM) {
      // CUSTOM solo se permite vía manual: NO marcamos skip aquí.
      // (es responsabilidad del cron filtrar por listDueForDate).
    } else if (!tpl.appliesTo(dateISO)) {
      return 'pattern_mismatch';
    }
    // Idempotencia: ya existe un run no-cancelado para (template, fecha)?
    return null; // se chequea dentro de la transacción para evitar TOCTOU
  }

  private inferShift(
    time: string,
  ): 'morning' | 'afternoon' | 'evening' | 'night' | 'custom' {
    const h = parseInt(time.slice(0, 2), 10);
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    if (h < 21) return 'evening';
    return 'night';
  }

  private isUniqueViolation(err: unknown): boolean {
    const e = err as { code?: string; driverError?: { code?: string } };
    return e?.code === '23505' || e?.driverError?.code === '23505';
  }

  private async generateTrackingCode(
    em: EntityManager,
    companyId: string,
  ): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code =
        'SHP-' +
        Date.now().toString(36).toUpperCase() +
        '-' +
        Math.random().toString(36).slice(2, 6).toUpperCase();
      const exists = await em.findOne(Shipment, {
        where: { companyId, trackingCode: code },
      });
      if (!exists) return code;
    }
    throw new ConflictException('Could not generate unique tracking code');
  }

  private async validateResourcesBelongToCarrier(
    companyId: string,
    truckId: string | null,
    driverId: string | null,
  ): Promise<void> {
    if (truckId) {
      const truck = await this.truckRepo.findOne({ where: { id: truckId } });
      if (!truck || truck.companyId !== companyId) {
        throw new ForbiddenException(
          `Truck ${truckId} does not belong to carrier ${companyId}`,
        );
      }
    }
    if (driverId) {
      const driver = await this.driverRepo.findOne({ where: { id: driverId } });
      if (!driver || driver.companyId !== companyId) {
        throw new ForbiddenException(
          `Driver ${driverId} does not belong to carrier ${companyId}`,
        );
      }
    }
  }

  private requireCompanyId(user: IUserPayload): string {
    if (!user.companyId) {
      throw new ForbiddenException('User has no company associated');
    }
    return user.companyId;
  }

  private assertTenantAccess(tpl: RecurringTemplate, user: IUserPayload): void {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (tpl.companyId !== user.companyId) {
      throw new ForbiddenException('You do not have access to this template');
    }
  }

  /** RT-001: solo carrier managers, no drivers ni customers de otra company. */
  private assertManagerRole(user: IUserPayload): void {
    const allowed: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.COMPANY_OWNER,
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.DISPATCHER,
    ];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException(
        'RT-001: only carrier managers can manage recurring templates',
      );
    }
  }
}
