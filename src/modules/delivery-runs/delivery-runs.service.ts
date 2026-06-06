import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DeliveryRun } from './entities/delivery-run.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { Truck } from '../trucks/entities/truck.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { CompanyRelationship } from '../relationships/entities/company-relationship.entity';

import {
  CreateDeliveryRunDto,
  UpdateDeliveryRunDto,
  AssignRunDriverDto,
  ShipmentIdsDto,
  ReorderDto,
  CancelDeliveryRunDto,
  StopDoneDto,
  StopIncidentDto,
  QueryDeliveryRunDto,
} from './dto';

import { DeliveryRunStatus } from '../../common/enums/delivery-run-status.enum';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { RelationshipStatus } from '../../common/enums/relationship-status.enum';
import { RelationshipType } from '../../common/enums/relationship-type.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { PaginationResponseDto } from '../../common/dto/pagination-response.dto';
import { INTERNAL_EVENTS } from '../../gateways/events/internal.events';
import { ComplianceService } from '../verifications/compliance.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PermissionsCacheService } from '../../common/cache/permissions-cache.service';

/**
 * DeliveryRunsService — Gestiona el manifiesto operativo del día.
 *
 * Aplica las 8 reglas de negocio definidas en PARTE 7 · sección 29.5:
 *   DR-001  un Shipment pertenece a 0 o 1 DeliveryRun simultáneamente
 *   DR-002  solo el carrier puede crear/modificar runs propios
 *   DR-003  al iniciar el run, shipments en CONFIRMED+asignados → ASSIGNED
 *   DR-004  al cerrar un stop, el shipment pasa a DELIVERED/INCIDENT y se incrementa completedStops
 *   DR-005  truckId/driverId deben pertenecer a la misma companyId del run
 *   DR-006  no se permite cambiar driverId/truckId si status=in_progress
 *   DR-007  optimizedSequence == set de shipmentIds del run (mismo conjunto)
 *   DR-008  reorder solo permitido en estados planned o ready
 *   DR-009  un driver no puede tener más de un run in_progress simultáneamente
 */
@Injectable()
export class DeliveryRunsService {
  private readonly logger = new Logger(DeliveryRunsService.name);

  constructor(
    @InjectRepository(DeliveryRun)
    private readonly runRepo: Repository<DeliveryRun>,
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    @InjectRepository(Truck)
    private readonly truckRepo: Repository<Truck>,
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
    @InjectRepository(CompanyRelationship)
    private readonly relRepo: Repository<CompanyRelationship>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly complianceService: ComplianceService,
    private readonly whatsapp: WhatsAppService,
    private readonly notificationsService: NotificationsService,
    private readonly permissionsCache: PermissionsCacheService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // CREATE — opcionalmente con shipmentIds iniciales
  // ═══════════════════════════════════════════════════════════
  async create(
    dto: CreateDeliveryRunDto,
    user: IUserPayload,
  ): Promise<DeliveryRun> {
    const companyId = this.requireCompanyId(user);

    // DR-005 (preventivo): valida que driver/truck pertenezcan al carrier
    if (dto.driverId || dto.truckId) {
      await this.validateResourcesBelongToCarrier(
        companyId,
        dto.truckId ?? null,
        dto.driverId ?? null,
      );
    }

    return this.dataSource.transaction(async (em) => {
      const run = em.create(DeliveryRun, {
        companyId,
        name: dto.name,
        scheduledDate: dto.scheduledDate,
        shift: dto.shift ?? 'morning',
        startTime: dto.startTime ?? null,
        driverId: dto.driverId ?? null,
        truckId: dto.truckId ?? null,
        routeId: dto.routeId ?? null,
        status: DeliveryRunStatus.PLANNED,
        optimizedSequence: [],
        totalStops: 0,
        completedStops: 0,
      });
      const saved = await em.save(run);

      if (dto.shipmentIds?.length) {
        await this.attachShipments(em, saved, dto.shipmentIds, companyId);
      }

      // Reload para devolver totalStops/secuencia actualizados
      const reloaded = await em.findOneOrFail(DeliveryRun, {
        where: { id: saved.id },
      });
      if (reloaded.driverId)
        this.notifyAssignedDriver(reloaded.driverId, reloaded);
      return reloaded;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // LIST con filtros + paginación. DRIVER solo ve los suyos.
  // ═══════════════════════════════════════════════════════════
  async findAll(
    query: QueryDeliveryRunDto,
    user: IUserPayload,
  ): Promise<PaginationResponseDto<DeliveryRun>> {
    const qb = this.runRepo.createQueryBuilder('run');

    // Tenant
    if (user.role !== UserRole.SUPER_ADMIN) {
      const companyId = this.requireCompanyId(user);
      qb.andWhere('run.companyId = :companyId', { companyId });
    }

    // Drivers solo ven sus propios runs (filtra por Driver entity ID, no User ID)
    if (user.role === UserRole.DRIVER) {
      const companyId = this.requireCompanyId(user);
      const driver = await this.driverRepo.findOne({
        where: { userId: user.sub, companyId },
        select: ['id'],
      });
      if (!driver) {
        return PaginationResponseDto.create([], 0, query.page, query.limit);
      }
      qb.andWhere('run.driverId = :driverEntityId', {
        driverEntityId: driver.id,
      });
    }

    if (query.date) {
      qb.andWhere('run.scheduledDate = :date', { date: query.date });
    }
    if (query.dateFrom) {
      qb.andWhere('run.scheduledDate >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    }
    if (query.dateTo) {
      qb.andWhere('run.scheduledDate <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.driverId) {
      qb.andWhere('run.driverId = :driverId', { driverId: query.driverId });
    }
    if (query.truckId) {
      qb.andWhere('run.truckId = :truckId', { truckId: query.truckId });
    }
    if (query.status) {
      qb.andWhere('run.status = :status', { status: query.status });
    }

    const allowedSort = ['scheduledDate', 'createdAt', 'status', 'name'];
    const sortBy = allowedSort.includes(query.sortBy || '')
      ? `run.${query.sortBy}`
      : 'run.scheduledDate';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortBy, sortOrder);

    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginationResponseDto.create(data, total, query.page, query.limit);
  }

  // ═══════════════════════════════════════════════════════════
  // FIND ONE (con shipments expandidos)
  // ═══════════════════════════════════════════════════════════
  async findOne(id: string, user: IUserPayload) {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException(`DeliveryRun ${id} not found`);
    this.assertTenantAccess(run, user);
    await this.assertDriverScope(run, user);

    const shipments = await this.shipmentRepo.find({
      where: { deliveryRunId: id },
      order: { runSequence: 'ASC' },
    });
    return { ...run, shipments };
  }

  // ═══════════════════════════════════════════════════════════
  // UPDATE (campos descriptivos)
  // ═══════════════════════════════════════════════════════════
  async update(
    id: string,
    dto: UpdateDeliveryRunDto,
    user: IUserPayload,
  ): Promise<DeliveryRun> {
    const run = await this.getOpenRun(id, user);
    this.assertCarrierAction(run, user);

    if (dto.name !== undefined) run.name = dto.name;
    if (dto.scheduledDate !== undefined) run.scheduledDate = dto.scheduledDate;
    if (dto.shift !== undefined) run.shift = dto.shift;
    if (dto.startTime !== undefined) run.startTime = dto.startTime;

    return this.runRepo.save(run);
  }

  // ═══════════════════════════════════════════════════════════
  // ASSIGN DRIVER / TRUCK  (DR-005, DR-006)
  // ═══════════════════════════════════════════════════════════
  async assignDriver(
    id: string,
    dto: AssignRunDriverDto,
    user: IUserPayload,
  ): Promise<DeliveryRun> {
    const run = await this.getOpenRun(id, user);
    this.assertCarrierAction(run, user);

    // DR-006
    if (run.status === DeliveryRunStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'DR-006: cannot reassign driver/truck while run is in_progress',
      );
    }

    if (dto.driverId !== undefined) run.driverId = dto.driverId ?? null;
    if (dto.truckId !== undefined) run.truckId = dto.truckId ?? null;

    // DR-005
    await this.validateResourcesBelongToCarrier(
      run.companyId,
      run.truckId,
      run.driverId,
    );

    // Auto-promoción a READY si tenemos driver + truck + ≥1 stop
    if (
      run.status === DeliveryRunStatus.PLANNED &&
      run.driverId &&
      run.truckId &&
      run.totalStops > 0
    ) {
      run.status = DeliveryRunStatus.READY;
    }

    const saved = await this.runRepo.save(run);
    if (saved.driverId) this.notifyAssignedDriver(saved.driverId, saved);
    return saved;
  }

  // ═══════════════════════════════════════════════════════════
  // ADD SHIPMENTS  (DR-001, DR-007)
  // ═══════════════════════════════════════════════════════════
  async addShipments(
    id: string,
    dto: ShipmentIdsDto,
    user: IUserPayload,
  ): Promise<DeliveryRun> {
    const run = await this.getOpenRun(id, user);
    this.assertCarrierAction(run, user);
    if (run.status === DeliveryRunStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Cannot modify shipments of a run already in_progress',
      );
    }

    return this.dataSource.transaction(async (em) => {
      await this.attachShipments(em, run, dto.shipmentIds, run.companyId);
      return em.findOneOrFail(DeliveryRun, { where: { id: run.id } });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // REMOVE SHIPMENTS
  // ═══════════════════════════════════════════════════════════
  async removeShipments(
    id: string,
    dto: ShipmentIdsDto,
    user: IUserPayload,
  ): Promise<DeliveryRun> {
    const run = await this.getOpenRun(id, user);
    this.assertCarrierAction(run, user);
    if (run.status === DeliveryRunStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Cannot modify shipments of a run already in_progress',
      );
    }

    return this.dataSource.transaction(async (em) => {
      const toRemove = await em.find(Shipment, {
        where: { id: In(dto.shipmentIds), deliveryRunId: run.id },
        select: ['id'],
      });
      if (!toRemove.length) {
        throw new BadRequestException(
          'None of the provided shipmentIds belong to this run',
        );
      }
      const removeIds = toRemove.map((s) => s.id);

      await em
        .createQueryBuilder()
        .update(Shipment)
        .set({ deliveryRunId: null, runSequence: null, eta: null })
        .where('id IN (:...ids)', { ids: removeIds })
        .execute();

      run.optimizedSequence = run.optimizedSequence.filter(
        (sid) => !removeIds.includes(sid),
      );
      run.totalStops = run.optimizedSequence.length;
      // Re-secuenciar 1..N
      await this.persistSequence(em, run);
      return em.findOneOrFail(DeliveryRun, { where: { id: run.id } });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // REORDER  (DR-007, DR-008)
  // ═══════════════════════════════════════════════════════════
  async reorder(
    id: string,
    dto: ReorderDto,
    user: IUserPayload,
  ): Promise<DeliveryRun> {
    const run = await this.getOpenRun(id, user);
    this.assertCarrierAction(run, user);

    // DR-008
    if (
      run.status !== DeliveryRunStatus.PLANNED &&
      run.status !== DeliveryRunStatus.READY
    ) {
      throw new BadRequestException(
        `DR-008: reorder only allowed in 'planned' or 'ready' (current: ${run.status})`,
      );
    }

    // DR-007
    const current = new Set(run.optimizedSequence);
    const incoming = new Set(dto.sequence);
    if (
      current.size !== incoming.size ||
      [...incoming].some((sid) => !current.has(sid))
    ) {
      throw new BadRequestException(
        'DR-007: sequence must be an exact permutation of the run shipments',
      );
    }

    return this.dataSource.transaction(async (em) => {
      run.optimizedSequence = dto.sequence;
      await this.persistSequence(em, run);
      return em.findOneOrFail(DeliveryRun, { where: { id: run.id } });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // START  (DR-003)
  // ═══════════════════════════════════════════════════════════
  async start(id: string, user: IUserPayload): Promise<DeliveryRun> {
    const run = await this.getOpenRun(id, user);
    await this.assertCarrierOrAssignedDriver(run, user);

    if (
      run.status !== DeliveryRunStatus.PLANNED &&
      run.status !== DeliveryRunStatus.READY
    ) {
      throw new BadRequestException(
        `Cannot start run from status '${run.status}'`,
      );
    }
    if (!run.driverId || !run.truckId) {
      throw new BadRequestException(
        'Run requires driver and truck before starting',
      );
    }
    if (run.totalStops === 0) {
      throw new BadRequestException('Run has no shipments to start');
    }

    // DR-009: un driver no puede tener más de un run in_progress simultáneamente.
    const [activeRow] = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM delivery_runs
       WHERE driver_id = $1
         AND status = 'in_progress'
         AND deleted_at IS NULL
         AND id != $2
       LIMIT 1`,
      [run.driverId, run.id],
    );
    if (activeRow) {
      throw new ConflictException(
        `El conductor ya tiene un run activo en progreso. Completa o cancela el run actual antes de iniciar uno nuevo.`,
      );
    }

    // MV-002 (PARTE 7 · Sprint 6): si la empresa opera passenger/mixed,
    // exige tier `passenger_safe` aprobado y vigente. Para freight es no-op.
    await this.complianceService.assertCanOperatePassenger(run.companyId);

    return this.dataSource.transaction(async (em) => {
      run.status = DeliveryRunStatus.IN_PROGRESS;
      run.startedAt = new Date();
      const saved = await em.save(run);

      // DR-003: avanzar shipments del run a estado operativo
      await this.advanceShipmentsOnStart(em, saved);

      this.eventEmitter.emit(INTERNAL_EVENTS.DELIVERY_RUN_STARTED, {
        runId: saved.id,
        companyId: saved.companyId,
        driverId: saved.driverId,
        truckId: saved.truckId,
        totalStops: saved.totalStops,
        startedAt: saved.startedAt,
      });
      this.logger.log(`DeliveryRun ${saved.id} started by ${user.sub}`);
      return saved;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // COMPLETE
  // ═══════════════════════════════════════════════════════════
  async complete(id: string, user: IUserPayload): Promise<DeliveryRun> {
    const run = await this.getOpenRun(id, user);
    await this.assertCarrierOrAssignedDriver(run, user);

    if (run.status !== DeliveryRunStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Only runs 'in_progress' can be completed (current: ${run.status})`,
      );
    }

    return this.completeInternal(id, user.sub);
  }

  // ═══════════════════════════════════════════════════════════
  // CANCEL
  // ═══════════════════════════════════════════════════════════
  async cancel(
    id: string,
    dto: CancelDeliveryRunDto,
    user: IUserPayload,
  ): Promise<DeliveryRun> {
    const run = await this.getOpenRun(id, user);
    this.assertCarrierAction(run, user);

    if (run.status === DeliveryRunStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed run');
    }

    return this.dataSource.transaction(async (em) => {
      run.status = DeliveryRunStatus.CANCELLED;
      run.cancelledAt = new Date();
      run.cancelReason = dto.reason;
      const saved = await em.save(run);

      // Liberar shipments aún no entregados (vuelven a ser asignables)
      await em
        .createQueryBuilder()
        .update(Shipment)
        .set({ deliveryRunId: null, runSequence: null, eta: null })
        .where('delivery_run_id = :rid', { rid: saved.id })
        .andWhere('status NOT IN (:...finals)', {
          finals: [
            ShipmentStatus.DELIVERED,
            ShipmentStatus.POD_UPLOADED,
            ShipmentStatus.COMPLETED,
            ShipmentStatus.INCIDENT,
          ],
        })
        .execute();

      this.eventEmitter.emit(INTERNAL_EVENTS.DELIVERY_RUN_CANCELLED, {
        runId: saved.id,
        companyId: saved.companyId,
        reason: dto.reason,
        cancelledAt: saved.cancelledAt,
      });
      return saved;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // STOP DONE  (DR-004)
  // ═══════════════════════════════════════════════════════════
  async stopDone(
    runId: string,
    shipmentId: string,
    dto: StopDoneDto,
    user: IUserPayload,
  ): Promise<{ run: DeliveryRun; shipment: Shipment }> {
    const { run, shipment } = await this.loadStop(runId, shipmentId, user);
    await this.assertCarrierOrAssignedDriver(run, user);

    if (run.status !== DeliveryRunStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Stops can only be closed while run is in_progress',
      );
    }
    if (
      shipment.status === ShipmentStatus.DELIVERED ||
      shipment.status === ShipmentStatus.POD_UPLOADED ||
      shipment.status === ShipmentStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Stop already closed (status=${shipment.status})`,
      );
    }

    const { updatedRun, updatedShipment, shouldComplete } =
      await this.dataSource.transaction(async (em) => {
        shipment.status = ShipmentStatus.DELIVERED;
        shipment.deliveredAt = new Date();
        if (dto.podUrl) {
          shipment.podUrl = dto.podUrl;
          shipment.podSignedBy = dto.signedBy ?? null;
          shipment.podUploadedAt = new Date();
          shipment.status = ShipmentStatus.POD_UPLOADED;
        }
        if (dto.notes) {
          shipment.notes =
            (shipment.notes ? shipment.notes + '\n' : '') +
            `[stop done] ${dto.notes}`;
        }
        await em.save(shipment);

        run.completedStops = await this.recountCompletedStops(em, run.id);
        await em.save(run);

        this.eventEmitter.emit(INTERNAL_EVENTS.DELIVERY_RUN_STOP_DONE, {
          runId: run.id,
          shipmentId: shipment.id,
          companyId: run.companyId,
          status: shipment.status,
          completedStops: run.completedStops,
          totalStops: run.totalStops,
        });

        return {
          updatedRun: run,
          updatedShipment: shipment,
          // Evaluated here so the count is from inside the transaction,
          // but completeInternal runs AFTER the tx commits to avoid lock contention.
          shouldComplete: run.completedStops >= run.totalStops,
        };
      });

    // Auto-complete outside the transaction so completeInternal can update the
    // run row without waiting on the lock held by the now-committed transaction.
    const finalRun = shouldComplete
      ? await this.completeInternal(updatedRun.id, user.sub)
      : updatedRun;

    // Fire-and-forget: WhatsApp delivery confirmation (gated by tracking.public_link)
    if (
      updatedShipment.destinationContactPhone &&
      updatedShipment.publicTrackingToken
    ) {
      this.permissionsCache
        .getOrLoad(run.companyId, () =>
          this.loadCompanyPermissions(run.companyId),
        )
        .then((perms) => {
          if (!perms.includes('tracking.public_link')) return;
          return this.whatsapp.sendDeliveryConfirmation(
            updatedShipment.destinationContactPhone!,
            updatedShipment.publicTrackingToken,
            updatedShipment.destinationAddress,
          );
        })
        .catch((err: Error) =>
          this.logger.warn(
            `[WhatsApp] delivery confirmation failed: ${err.message}`,
          ),
        );
    }

    return { run: finalRun, shipment: updatedShipment };
  }

  // ═══════════════════════════════════════════════════════════
  // STOP START TRANSIT  (driver opened stop screen → IN_TRANSIT)
  // ═══════════════════════════════════════════════════════════
  async stopStartTransit(
    runId: string,
    shipmentId: string,
    user: IUserPayload,
  ): Promise<Shipment> {
    const { run, shipment } = await this.loadStop(runId, shipmentId, user);
    await this.assertCarrierOrAssignedDriver(run, user);

    if (run.status !== DeliveryRunStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Stops can only be marked while run is in_progress',
      );
    }

    // Idempotent: already in transit or further along
    if (
      shipment.status === ShipmentStatus.IN_TRANSIT ||
      shipment.status === ShipmentStatus.AT_STOP ||
      shipment.status === ShipmentStatus.DELIVERED ||
      shipment.status === ShipmentStatus.POD_UPLOADED ||
      shipment.status === ShipmentStatus.COMPLETED
    ) {
      return shipment;
    }

    shipment.status = ShipmentStatus.IN_TRANSIT;
    return this.shipmentRepo.save(shipment);
  }

  // ═══════════════════════════════════════════════════════════
  // STOP ARRIVE  (driver reached the stop → AT_STOP)
  // ═══════════════════════════════════════════════════════════
  async stopArrive(
    runId: string,
    shipmentId: string,
    user: IUserPayload,
  ): Promise<Shipment> {
    const { run, shipment } = await this.loadStop(runId, shipmentId, user);
    await this.assertCarrierOrAssignedDriver(run, user);

    if (run.status !== DeliveryRunStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Stops can only be marked while run is in_progress',
      );
    }

    // Idempotent: already at stop or further along
    if (
      shipment.status === ShipmentStatus.AT_STOP ||
      shipment.status === ShipmentStatus.DELIVERED ||
      shipment.status === ShipmentStatus.POD_UPLOADED ||
      shipment.status === ShipmentStatus.COMPLETED
    ) {
      return shipment;
    }

    shipment.status = ShipmentStatus.AT_STOP;
    return this.shipmentRepo.save(shipment);
  }

  // ═══════════════════════════════════════════════════════════
  // STOP INCIDENT
  // ═══════════════════════════════════════════════════════════
  async stopIncident(
    runId: string,
    shipmentId: string,
    dto: StopIncidentDto,
    user: IUserPayload,
  ): Promise<{ run: DeliveryRun; shipment: Shipment }> {
    const { run, shipment } = await this.loadStop(runId, shipmentId, user);
    await this.assertCarrierOrAssignedDriver(run, user);

    if (run.status !== DeliveryRunStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Stops can only be marked while run is in_progress',
      );
    }

    const { updatedRun, updatedShipment, shouldComplete } =
      await this.dataSource.transaction(async (em) => {
        shipment.status = ShipmentStatus.INCIDENT;
        shipment.notes =
          (shipment.notes ? shipment.notes + '\n' : '') +
          `[INCIDENT] ${dto.reason}` +
          (dto.photoUrl ? ` photo=${dto.photoUrl}` : '');
        await em.save(shipment);

        run.completedStops = await this.recountCompletedStops(em, run.id);
        await em.save(run);

        this.eventEmitter.emit(INTERNAL_EVENTS.DELIVERY_RUN_STOP_INCIDENT, {
          runId: run.id,
          shipmentId: shipment.id,
          companyId: run.companyId,
          reason: dto.reason,
          photoUrl: dto.photoUrl ?? null,
          completedStops: run.completedStops,
          totalStops: run.totalStops,
        });

        return {
          updatedRun: run,
          updatedShipment: shipment,
          shouldComplete: run.completedStops >= run.totalStops,
        };
      });

    const finalRun = shouldComplete
      ? await this.completeInternal(updatedRun.id, user.sub)
      : updatedRun;

    return { run: finalRun, shipment: updatedShipment };
  }

  // ═══════════════════════════════════════════════════════════
  //   ─── HELPERS PRIVADOS ───
  // ═══════════════════════════════════════════════════════════

  private async completeInternal(
    runId: string,
    actorSub: string,
  ): Promise<DeliveryRun> {
    const run = await this.runRepo.findOneOrFail({ where: { id: runId } });
    run.status = DeliveryRunStatus.COMPLETED;
    run.finishedAt = new Date();
    const saved = await this.runRepo.save(run);

    // Snapshot de los shipments al cerrar
    const shipments = await this.shipmentRepo.find({
      where: { deliveryRunId: runId },
      select: ['id', 'status'],
    });
    const deliveredCount = shipments.filter(
      (s) =>
        s.status === ShipmentStatus.DELIVERED ||
        s.status === ShipmentStatus.POD_UPLOADED ||
        s.status === ShipmentStatus.COMPLETED,
    ).length;
    const incidentCount = shipments.filter(
      (s) => s.status === ShipmentStatus.INCIDENT,
    ).length;

    this.eventEmitter.emit(INTERNAL_EVENTS.DELIVERY_RUN_COMPLETED, {
      runId: saved.id,
      companyId: saved.companyId,
      finishedAt: saved.finishedAt,
      totalStops: saved.totalStops,
      deliveredCount,
      incidentCount,
    });
    this.logger.log(`DeliveryRun ${saved.id} completed by ${actorSub}`);
    return saved;
  }

  /**
   * Adjunta shipments al run, validando DR-001 y actualizando secuencia.
   */
  private async attachShipments(
    em: import('typeorm').EntityManager,
    run: DeliveryRun,
    shipmentIds: string[],
    carrierCompanyId: string,
  ): Promise<void> {
    const shipments = await em.find(Shipment, {
      where: { id: In(shipmentIds) },
    });
    if (shipments.length !== shipmentIds.length) {
      const found = new Set(shipments.map((s) => s.id));
      const missing = shipmentIds.filter((id) => !found.has(id));
      throw new NotFoundException(`Shipments not found: ${missing.join(', ')}`);
    }

    for (const s of shipments) {
      if (s.companyId !== carrierCompanyId) {
        throw new ForbiddenException(
          `Shipment ${s.id} does not belong to carrier ${carrierCompanyId}`,
        );
      }
      // DR-001
      if (s.deliveryRunId && s.deliveryRunId !== run.id) {
        throw new BadRequestException(
          `DR-001: shipment ${s.id} already belongs to run ${s.deliveryRunId}`,
        );
      }
      // No agregar shipments en estados finales
      if (
        s.status === ShipmentStatus.COMPLETED ||
        s.status === ShipmentStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Shipment ${s.id} is in terminal status (${s.status})`,
        );
      }
    }

    // Persistir vínculo + secuencia incremental
    const currentSeq = [...run.optimizedSequence];
    let next = currentSeq.length + 1;
    for (const s of shipments) {
      if (currentSeq.includes(s.id)) continue; // ya estaba
      s.deliveryRunId = run.id;
      s.runSequence = next++;
      await em.save(s);
      currentSeq.push(s.id);
    }

    run.optimizedSequence = currentSeq;
    run.totalStops = currentSeq.length;
    await em.save(run);

    // Auto-promoción PLANNED → READY si ya tenía driver+truck
    if (
      run.status === DeliveryRunStatus.PLANNED &&
      run.driverId &&
      run.truckId &&
      run.totalStops > 0
    ) {
      run.status = DeliveryRunStatus.READY;
      await em.save(run);
    }
  }

  /**
   * Reescribe `runSequence` 1..N en función del orden actual de
   * `run.optimizedSequence` y persiste el run.
   */
  private async persistSequence(
    em: import('typeorm').EntityManager,
    run: DeliveryRun,
  ): Promise<void> {
    let pos = 1;
    for (const sid of run.optimizedSequence) {
      await em
        .createQueryBuilder()
        .update(Shipment)
        .set({ runSequence: pos++ })
        .where('id = :id', { id: sid })
        .execute();
    }
    await em.save(run);
  }

  /**
   * DR-003 — al iniciar el run, los shipments en CONFIRMED con driver+truck
   * pasan a ASSIGNED. Shipments ya operativos se respetan.
   */
  private async advanceShipmentsOnStart(
    em: import('typeorm').EntityManager,
    run: DeliveryRun,
  ): Promise<void> {
    const shipments = await em.find(Shipment, {
      where: { deliveryRunId: run.id },
    });
    for (const s of shipments) {
      // Asegurar driver/truck del run
      if (!s.driverId) s.driverId = run.driverId;
      if (!s.truckId) s.truckId = run.truckId;

      if (s.status === ShipmentStatus.CONFIRMED && s.driverId && s.truckId) {
        s.status = ShipmentStatus.ASSIGNED;
      }
      await em.save(s);
    }
  }

  private async recountCompletedStops(
    em: import('typeorm').EntityManager,
    runId: string,
  ): Promise<number> {
    return em.count(Shipment, {
      where: [
        { deliveryRunId: runId, status: ShipmentStatus.DELIVERED },
        { deliveryRunId: runId, status: ShipmentStatus.POD_UPLOADED },
        { deliveryRunId: runId, status: ShipmentStatus.COMPLETED },
        { deliveryRunId: runId, status: ShipmentStatus.INCIDENT },
      ],
    });
  }

  private async loadStop(
    runId: string,
    shipmentId: string,
    user: IUserPayload,
  ): Promise<{ run: DeliveryRun; shipment: Shipment }> {
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException(`DeliveryRun ${runId} not found`);
    this.assertTenantAccess(run, user);

    const shipment = await this.shipmentRepo.findOne({
      where: { id: shipmentId, deliveryRunId: runId },
    });
    if (!shipment) {
      throw new NotFoundException(
        `Shipment ${shipmentId} not found in run ${runId}`,
      );
    }
    return { run, shipment };
  }

  private async getOpenRun(
    id: string,
    user: IUserPayload,
  ): Promise<DeliveryRun> {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException(`DeliveryRun ${id} not found`);
    this.assertTenantAccess(run, user);
    return run;
  }

  private requireCompanyId(user: IUserPayload): string {
    if (!user.companyId) {
      throw new ForbiddenException('User has no company associated');
    }
    return user.companyId;
  }

  private assertTenantAccess(run: DeliveryRun, user: IUserPayload): void {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (run.companyId !== user.companyId) {
      throw new ForbiddenException('You do not have access to this run');
    }
  }

  /** Resuelve el Driver entity ID a partir del User UUID del JWT. */
  private async resolveDriverEntityId(
    userId: string,
    companyId: string,
  ): Promise<string | null> {
    const driver = await this.driverRepo.findOne({
      where: { userId, companyId },
      select: ['id'],
    });
    return driver?.id ?? null;
  }

  /** Driver solo accede a runs donde es el driverId asignado (DR-002 + scope). */
  private async assertDriverScope(
    run: DeliveryRun,
    user: IUserPayload,
  ): Promise<void> {
    if (user.role !== UserRole.DRIVER) return;
    const driverEntityId = await this.resolveDriverEntityId(
      user.sub,
      run.companyId,
    );
    if (!driverEntityId || run.driverId !== driverEntityId) {
      throw new ForbiddenException('Driver can only access assigned runs');
    }
  }

  /** DR-002: solo el carrier (no el customer) puede modificar runs propios. */
  private assertCarrierAction(run: DeliveryRun, user: IUserPayload): void {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (run.companyId !== user.companyId) {
      throw new ForbiddenException(
        'DR-002: only the carrier company can modify this run',
      );
    }
    if (user.role === UserRole.DRIVER) {
      throw new ForbiddenException(
        'DR-002: drivers cannot modify run definition',
      );
    }
  }

  /** Para start/complete/stops: carrier (managers) o el driver asignado. */
  private async assertCarrierOrAssignedDriver(
    run: DeliveryRun,
    user: IUserPayload,
  ): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (run.companyId !== user.companyId) {
      throw new ForbiddenException('Not your run');
    }
    if (user.role === UserRole.DRIVER) {
      const driverEntityId = await this.resolveDriverEntityId(
        user.sub,
        run.companyId,
      );
      if (!driverEntityId || run.driverId !== driverEntityId) {
        throw new ForbiddenException(
          'Only the assigned driver can act on this run',
        );
      }
    }
  }

  /** DR-005 — trucks must be own; drivers may be own OR active partner company. */
  private async validateResourcesBelongToCarrier(
    carrierCompanyId: string,
    truckId: string | null | undefined,
    driverId: string | null | undefined,
  ): Promise<void> {
    if (truckId) {
      const truck = await this.truckRepo.findOne({
        where: { id: truckId },
        select: ['id', 'companyId'],
      });
      if (!truck) throw new BadRequestException(`Truck ${truckId} not found`);
      if (truck.companyId !== carrierCompanyId) {
        throw new ForbiddenException(
          `DR-005: Truck ${truckId} does not belong to carrier ${carrierCompanyId}`,
        );
      }
    }
    if (driverId) {
      const driver = await this.driverRepo.findOne({
        where: { id: driverId },
        select: ['id', 'companyId'],
      });
      if (!driver)
        throw new BadRequestException(`Driver ${driverId} not found`);
      if (driver.companyId !== carrierCompanyId) {
        const hasPartnerRelation = await this.relRepo.findOne({
          where: [
            {
              parentCompanyId: carrierCompanyId,
              childCompanyId: driver.companyId,
              status: RelationshipStatus.ACCEPTED,
              relationshipType: RelationshipType.COVERED_CARRIER,
            },
            {
              parentCompanyId: carrierCompanyId,
              childCompanyId: driver.companyId,
              status: RelationshipStatus.ACCEPTED,
              relationshipType: RelationshipType.ASSOCIATED_COMPANY,
            },
            {
              parentCompanyId: driver.companyId,
              childCompanyId: carrierCompanyId,
              status: RelationshipStatus.ACCEPTED,
              relationshipType: RelationshipType.COVERED_CARRIER,
            },
            {
              parentCompanyId: driver.companyId,
              childCompanyId: carrierCompanyId,
              status: RelationshipStatus.ACCEPTED,
              relationshipType: RelationshipType.ASSOCIATED_COMPANY,
            },
          ],
          select: ['id'],
        });
        if (!hasPartnerRelation) {
          throw new ForbiddenException(
            `DR-005: Driver ${driverId} does not belong to carrier ${carrierCompanyId} or an active partner company`,
          );
        }
      }
    }
  }

  /**
   * Retorna los drivers asignables a un run: propios + empresas partner activas
   * (covered_carrier o associated_company con status=accepted).
   */
  async getAssignableDrivers(
    runId: string,
    user: IUserPayload,
  ): Promise<Driver[]> {
    const run = await this.runRepo.findOne({
      where: { id: runId },
      select: ['id', 'companyId'],
    });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    this.assertCarrierAction(run, user);

    const companyId = run.companyId;

    // IDs de empresas partner con relación activa
    const relations = await this.relRepo.find({
      where: [
        {
          parentCompanyId: companyId,
          status: RelationshipStatus.ACCEPTED,
          relationshipType: RelationshipType.COVERED_CARRIER,
        },
        {
          parentCompanyId: companyId,
          status: RelationshipStatus.ACCEPTED,
          relationshipType: RelationshipType.ASSOCIATED_COMPANY,
        },
        {
          childCompanyId: companyId,
          status: RelationshipStatus.ACCEPTED,
          relationshipType: RelationshipType.COVERED_CARRIER,
        },
        {
          childCompanyId: companyId,
          status: RelationshipStatus.ACCEPTED,
          relationshipType: RelationshipType.ASSOCIATED_COMPANY,
        },
      ],
      select: ['parentCompanyId', 'childCompanyId'],
    });

    const partnerIds = new Set<string>();
    for (const r of relations) {
      if (r.parentCompanyId !== companyId) partnerIds.add(r.parentCompanyId);
      if (r.childCompanyId !== companyId) partnerIds.add(r.childCompanyId);
    }

    const eligibleCompanyIds = [companyId, ...partnerIds];

    return this.driverRepo
      .createQueryBuilder('driver')
      .where('driver.companyId IN (:...ids)', { ids: eligibleCompanyIds })
      .andWhere('driver.deletedAt IS NULL')
      .orderBy('driver.companyId = :own', 'DESC', 'NULLS LAST')
      .addOrderBy('driver.firstName', 'ASC')
      .setParameter('own', companyId)
      .getMany();
  }

  /**
   * Envía push notification al driver cuando se le asigna un run.
   * Best-effort: no lanza si el driver no tiene cuenta o push token.
   */
  private notifyAssignedDriver(driverId: string, run: DeliveryRun): void {
    this.driverRepo
      .findOne({ where: { id: driverId }, select: ['userId'] })
      .then((driver) => {
        if (!driver?.userId) return;
        return this.notificationsService.create({
          userId: driver.userId,
          type: NotificationType.RUN_ASSIGNED,
          title: 'Nueva ruta asignada',
          body: `Tienes una ruta programada para el ${run.scheduledDate}`,
          data: { runId: run.id, scheduledDate: run.scheduledDate },
        });
      })
      .catch((err) =>
        this.logger.warn(`notifyAssignedDriver error: ${err?.message ?? err}`),
      );
  }

  private async loadCompanyPermissions(companyId: string): Promise<string[]> {
    const rows: Array<{ code: string }> = await this.dataSource.query(
      `SELECT pd.code
         FROM subscriptions s
         JOIN plan_permissions pp ON pp.plan_id = s.plan_id
         JOIN permission_definitions pd ON pd.id = pp.permission_id
        WHERE s.company_id = $1 AND s.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 100`,
      [companyId],
    );
    return rows.map((r) => r.code);
  }
}
