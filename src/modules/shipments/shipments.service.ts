import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Shipment } from './entities/shipment.entity';
import { Truck } from '../trucks/entities/truck.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { User } from '../auth/entities/user.entity';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  QueryShipmentDto,
  AssignShipmentDto,
  UploadPodDto,
  AcceptShipmentDto,
  RejectShipmentDto,
} from './dto';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { PaginationResponseDto } from '../../common/dto/pagination-response.dto';
import { RelationshipsService } from '../relationships/relationships.service';
import { NotificationsService } from '../notifications/notifications.service';
import { randomUUID } from 'crypto';

/**
 * Roles que pueden gestionar shipments dentro de una empresa carrier o cliente.
 * (DRIVER queda fuera porque solo actualiza estados operativos vía updateStatus.)
 */
const MANAGEMENT_ROLES = [
  UserRole.COMPANY_OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.DISPATCHER,
];

/**
 * Campos que el CLIENTE (customerCompanyId) puede modificar.
 * El cliente solo controla la información de la carga y direcciones.
 */
const CUSTOMER_EDITABLE_FIELDS = new Set<keyof UpdateShipmentDto>([
  'referenceNumber',
  'priority',
  'originAddress',
  'originLat',
  'originLng',
  'originContactName',
  'originContactPhone',
  'destinationAddress',
  'destinationLat',
  'destinationLng',
  'destinationContactName',
  'destinationContactPhone',
  'description',
  'weightKg',
  'volumeM3',
  'pieces',
  'cargoType',
  'pickupAt',
  'deliveryAt',
  'notes',
]);

/**
 * Campos que el CARRIER (companyId) puede modificar.
 * Incluye TODO lo del cliente + asignaciones operativas + pricing.
 */
const CARRIER_EDITABLE_FIELDS = new Set<keyof UpdateShipmentDto>([
  ...CUSTOMER_EDITABLE_FIELDS,
  'truckId',
  'driverId',
  'routeId',
  'price',
  'currency',
] as Array<keyof UpdateShipmentDto>);

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
    @InjectRepository(Truck)
    private readonly truckRepository: Repository<Truck>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly relationshipsService: RelationshipsService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────────
  // CREATE
  //  - Si no se especifica customerCompanyId o coincide con el carrier,
  //    es un shipment "interno" → status DRAFT (flujo clásico).
  //  - Si customerCompanyId difiere de companyId (subcontratación):
  //      a) Validar que existe relación ACEPTADA entre ambas empresas
  //      b) Status PENDING_ACCEPTANCE
  //      c) Notificar a los admins/dispatchers de la empresa carrier
  // ─────────────────────────────────────────────
  async create(dto: CreateShipmentDto, user: IUserPayload): Promise<Shipment> {
    const userCompanyId = this.requireCompanyId(user);

    if (user.role !== UserRole.SUPER_ADMIN) {
      await this.checkDailyShipmentLimit(userCompanyId);
    }

    // Por convención, el creador siempre forma parte de la transacción:
    //  - Si dto.customerCompanyId está presente → quien crea es el CLIENTE,
    //    y la empresa creadora se considera el CUSTOMER. Pero el carrier (companyId)
    //    puede haber sido seleccionado por el cliente (campo dto.companyId opcional)
    //    o, si no se pasa, se asume que es un shipment interno.
    //
    // Para mantener simple el flujo y no romper compatibilidad, definimos:
    //   - companyId        = userCompanyId (la empresa que opera/ejecuta el envío por defecto)
    //   - customerCompanyId = dto.customerCompanyId (cliente externo opcional)
    //
    // Para subcontratación inversa (cliente A propone a carrier B), el cliente debe
    // crear el shipment usando un endpoint donde dto contenga el carrier objetivo.
    // Lo soportamos vía dto.proposedCarrierId si se provee:
    const carrierId =
      (dto as CreateShipmentDto & { proposedCarrierId?: string })
        .proposedCarrierId || userCompanyId;
    const customerCompanyId = dto.customerCompanyId || null;

    // ─── Determinar si es cross-company ───
    const isCrossCompany =
      customerCompanyId !== null && customerCompanyId !== carrierId;

    // ─── Determinar si el creador es cliente o carrier ───
    const creatorIsCustomer = customerCompanyId === userCompanyId;
    const creatorIsCarrier = carrierId === userCompanyId;

    if (isCrossCompany) {
      if (!creatorIsCustomer && !creatorIsCarrier) {
        throw new ForbiddenException(
          'You must be either the customer or the carrier on this shipment',
        );
      }

      // Validar relación activa entre ambas empresas
      const ok = await this.relationshipsService.isActiveBetween(
        customerCompanyId,
        carrierId,
      );
      if (!ok) {
        throw new ForbiddenException(
          `No active business relationship exists between customer ${customerCompanyId} and carrier ${carrierId}. ` +
            `Establish a relationship in /v1/relationships first.`,
        );
      }
    }

    const trackingCode = await this.generateTrackingCode(carrierId);

    // Determinar status inicial:
    //  - Cross-company y creado por el cliente → PENDING_ACCEPTANCE (carrier debe aceptar)
    //  - Cross-company y creado por el carrier → DRAFT (carrier ya conoce y maneja)
    //  - Single-company → DRAFT (o lo que pase en dto.status)
    const initialStatus =
      isCrossCompany && creatorIsCustomer
        ? ShipmentStatus.PENDING_ACCEPTANCE
        : dto.status || ShipmentStatus.DRAFT;

    const shipment = this.shipmentRepository.create({
      ...dto,
      companyId: carrierId,
      customerCompanyId,
      trackingCode,
      publicTrackingToken: randomUUID(),
      status: initialStatus,
      priority: dto.priority || 'normal',
      cargoType: dto.cargoType || 'general',
      currency: dto.currency || 'USD',
      proposedBy:
        initialStatus === ShipmentStatus.PENDING_ACCEPTANCE ? user.sub : null,
      proposedAt:
        initialStatus === ShipmentStatus.PENDING_ACCEPTANCE ? new Date() : null,
    });

    // Si el carrier asignó truck/driver al crear, validar pertenencia
    if (shipment.truckId || shipment.driverId) {
      await this.validateResourcesBelongToCarrier(
        carrierId,
        shipment.truckId,
        shipment.driverId,
      );
    }

    const saved = await this.shipmentRepository.save(shipment);
    this.logger.log(
      `Shipment created: ${saved.trackingCode} (${saved.id}) status=${saved.status}`,
    );

    // Notificar al carrier si está pendiente de aceptación
    if (saved.status === ShipmentStatus.PENDING_ACCEPTANCE) {
      await this.notifyCompanyManagers(
        carrierId,
        NotificationType.SHIPMENT_PROPOSED,
        'Nueva solicitud de envío',
        `${customerCompanyId} te propone el envío ${saved.trackingCode}`,
        { shipmentId: saved.id, trackingCode: saved.trackingCode },
      );
    }

    return saved;
  }

  // ─────────────────────────────────────────────
  // FIND ALL
  // ─────────────────────────────────────────────
  async findAll(
    query: QueryShipmentDto,
    user: IUserPayload,
  ): Promise<PaginationResponseDto<Shipment>> {
    const qb = this.shipmentRepository
      .createQueryBuilder('shipment')
      .where('shipment.deletedAt IS NULL');

    if (user.role === UserRole.SUPER_ADMIN) {
      if (query.companyId) {
        qb.andWhere('shipment.companyId = :companyId', {
          companyId: query.companyId,
        });
      }
    } else {
      const companyId = this.requireCompanyId(user);
      qb.andWhere(
        '(shipment.companyId = :companyId OR shipment.customerCompanyId = :companyId)',
        { companyId },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(shipment.trackingCode ILIKE :search OR shipment.referenceNumber ILIKE :search OR shipment.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.status)
      qb.andWhere('shipment.status = :status', { status: query.status });
    if (query.priority)
      qb.andWhere('shipment.priority = :priority', {
        priority: query.priority,
      });
    if (query.driverId)
      qb.andWhere('shipment.driverId = :driverId', {
        driverId: query.driverId,
      });
    if (query.truckId)
      qb.andWhere('shipment.truckId = :truckId', { truckId: query.truckId });
    if (query.routeId)
      qb.andWhere('shipment.routeId = :routeId', { routeId: query.routeId });
    if (query.customerCompanyId) {
      qb.andWhere('shipment.customerCompanyId = :ccid', {
        ccid: query.customerCompanyId,
      });
    }
    if (query.pickupFrom) {
      qb.andWhere('shipment.pickupAt >= :pickupFrom', {
        pickupFrom: query.pickupFrom,
      });
    }
    if (query.pickupTo) {
      qb.andWhere('shipment.pickupAt <= :pickupTo', {
        pickupTo: query.pickupTo,
      });
    }

    const allowedSort = [
      'trackingCode',
      'status',
      'priority',
      'pickupAt',
      'deliveryAt',
      'createdAt',
    ];
    const sortBy = allowedSort.includes(query.sortBy || '')
      ? `shipment.${query.sortBy}`
      : 'shipment.createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortBy, sortOrder);

    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginationResponseDto.create(data, total, query.page, query.limit);
  }

  // ─────────────────────────────────────────────
  // FIND ONE
  // ─────────────────────────────────────────────
  async findOne(id: string, user: IUserPayload): Promise<Shipment> {
    const shipment = await this.shipmentRepository.findOne({ where: { id } });
    if (!shipment) {
      throw new NotFoundException(`Shipment ${id} not found`);
    }
    this.assertTenantAccess(shipment, user);
    return shipment;
  }

  async findByTrackingCode(code: string): Promise<Shipment> {
    const shipment = await this.shipmentRepository.findOne({
      where: { trackingCode: code },
    });
    if (!shipment) {
      throw new NotFoundException(`Shipment with tracking "${code}" not found`);
    }
    return shipment;
  }

  // ─────────────────────────────────────────────
  // UPDATE
  //  - Bloqueado en COMPLETED, CANCELLED, REJECTED
  //  - En PENDING_ACCEPTANCE: solo el cliente puede editar (mientras espera respuesta)
  //  - Campos editables filtrados según rol (cliente vs carrier)
  // ─────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateShipmentDto,
    user: IUserPayload,
  ): Promise<Shipment> {
    const shipment = await this.findOne(id, user);

    if (
      shipment.status === ShipmentStatus.COMPLETED ||
      shipment.status === ShipmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot edit shipment with status ${shipment.status}`,
      );
    }

    const role = this.getShipmentRole(shipment, user);
    const allowedFields =
      role === 'carrier' ? CARRIER_EDITABLE_FIELDS : CUSTOMER_EDITABLE_FIELDS;

    // Si está PENDING_ACCEPTANCE solo el cliente puede modificar
    if (
      shipment.status === ShipmentStatus.PENDING_ACCEPTANCE &&
      role !== 'customer' &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'While shipment is pending acceptance, only the customer can update it',
      );
    }

    // Filtrar campos según permisos
    const filtered: Partial<UpdateShipmentDto> = {};
    const rejected: string[] = [];
    for (const key of Object.keys(dto) as Array<keyof UpdateShipmentDto>) {
      if (allowedFields.has(key)) {
        (filtered as any)[key] = (dto as any)[key];
      } else {
        rejected.push(key);
      }
    }
    if (rejected.length && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        `Your role (${role}) cannot edit these fields: ${rejected.join(', ')}`,
      );
    }

    // Si vienen truck/driver, validar pertenencia al carrier
    if (filtered.truckId !== undefined || filtered.driverId !== undefined) {
      await this.validateResourcesBelongToCarrier(
        shipment.companyId,
        filtered.truckId ?? shipment.truckId,
        filtered.driverId ?? shipment.driverId,
      );
    }

    Object.assign(shipment, filtered);
    return this.shipmentRepository.save(shipment);
  }

  // ─────────────────────────────────────────────
  // STATUS WORKFLOW
  //  - PENDING_ACCEPTANCE solo se cambia vía accept()/reject()
  //  - Estados operativos (picked_up, in_transit, delivered) → solo carrier o driver
  // ─────────────────────────────────────────────
  async updateStatus(
    id: string,
    status: ShipmentStatus,
    user: IUserPayload,
  ): Promise<Shipment> {
    const shipment = await this.findOne(id, user);

    // PENDING_ACCEPTANCE no puede ser cambiado vía updateStatus directo
    if (
      shipment.status === ShipmentStatus.PENDING_ACCEPTANCE ||
      status === ShipmentStatus.PENDING_ACCEPTANCE
    ) {
      throw new BadRequestException(
        'Use POST /shipments/:id/accept or /reject for pending shipments',
      );
    }

    // Operaciones de status son responsabilidad del CARRIER (y del driver para algunos)
    this.assertCarrierAction(shipment, user);
    this.assertValidTransition(shipment.status, status);

    shipment.status = status;
    if (status === ShipmentStatus.PICKED_UP) shipment.pickedUpAt = new Date();
    if (status === ShipmentStatus.DELIVERED) shipment.deliveredAt = new Date();

    const saved = await this.shipmentRepository.save(shipment);
    this.logger.log(`Shipment ${saved.trackingCode} -> ${status}`);

    // Notificar al cliente si existe (cross-company)
    if (
      saved.customerCompanyId &&
      saved.customerCompanyId !== saved.companyId
    ) {
      await this.notifyCompanyManagers(
        saved.customerCompanyId,
        NotificationType.SHIPMENT_STATUS,
        `Envío ${saved.trackingCode}: ${status}`,
        `El estado de tu envío cambió a ${status}`,
        { shipmentId: saved.id, trackingCode: saved.trackingCode, status },
      );
    }
    return saved;
  }

  // ─────────────────────────────────────────────
  // ASSIGN truck/driver/route — solo CARRIER
  // ─────────────────────────────────────────────
  async assign(
    id: string,
    dto: AssignShipmentDto,
    user: IUserPayload,
  ): Promise<Shipment> {
    const shipment = await this.findOne(id, user);
    this.assertCarrierAction(shipment, user);

    if (shipment.status === ShipmentStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException(
        'Cannot assign resources to a pending shipment. Accept it first.',
      );
    }

    if (dto.truckId !== undefined) shipment.truckId = dto.truckId || null;
    if (dto.driverId !== undefined) shipment.driverId = dto.driverId || null;
    if (dto.routeId !== undefined) shipment.routeId = dto.routeId || null;

    // Validar pertenencia al carrier
    await this.validateResourcesBelongToCarrier(
      shipment.companyId,
      shipment.truckId,
      shipment.driverId,
    );

    if (
      shipment.status === ShipmentStatus.CONFIRMED &&
      shipment.truckId &&
      shipment.driverId
    ) {
      shipment.status = ShipmentStatus.ASSIGNED;
    }

    return this.shipmentRepository.save(shipment);
  }

  // ─────────────────────────────────────────────
  // ACCEPT (solo carrier, solo en PENDING_ACCEPTANCE)
  // ─────────────────────────────────────────────
  async accept(
    id: string,
    dto: AcceptShipmentDto,
    user: IUserPayload,
  ): Promise<Shipment> {
    const shipment = await this.findOne(id, user);
    this.assertCarrierAction(shipment, user);

    if (shipment.status !== ShipmentStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException(
        `Only shipments in 'pending_acceptance' can be accepted. Current: ${shipment.status}`,
      );
    }

    shipment.status = ShipmentStatus.CONFIRMED;
    shipment.acceptedBy = user.sub;
    shipment.acceptedAt = new Date();
    if (dto.notes) {
      shipment.notes =
        (shipment.notes ? shipment.notes + '\n' : '') +
        `[Carrier acceptance] ${dto.notes}`;
    }

    const saved = await this.shipmentRepository.save(shipment);
    this.logger.log(`Shipment ${saved.trackingCode} accepted by ${user.sub}`);

    // Notificar al cliente
    if (saved.customerCompanyId) {
      await this.notifyCompanyManagers(
        saved.customerCompanyId,
        NotificationType.SHIPMENT_ACCEPTED,
        `Envío ${saved.trackingCode} aceptado`,
        `El carrier aceptó tu envío y ahora está confirmado`,
        { shipmentId: saved.id, trackingCode: saved.trackingCode },
      );
    }
    return saved;
  }

  // ─────────────────────────────────────────────
  // REJECT (solo carrier, solo en PENDING_ACCEPTANCE)
  // ─────────────────────────────────────────────
  async reject(
    id: string,
    dto: RejectShipmentDto,
    user: IUserPayload,
  ): Promise<Shipment> {
    const shipment = await this.findOne(id, user);
    this.assertCarrierAction(shipment, user);

    if (shipment.status !== ShipmentStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException(
        `Only shipments in 'pending_acceptance' can be rejected. Current: ${shipment.status}`,
      );
    }

    shipment.status = ShipmentStatus.CANCELLED;
    shipment.rejectedBy = user.sub;
    shipment.rejectedAt = new Date();
    shipment.rejectionReason = dto.reason;
    shipment.cancelledAt = new Date();
    shipment.cancelReason = `Rejected by carrier: ${dto.reason}`;

    const saved = await this.shipmentRepository.save(shipment);
    this.logger.log(
      `Shipment ${saved.trackingCode} rejected by ${user.sub}: ${dto.reason}`,
    );

    if (saved.customerCompanyId) {
      await this.notifyCompanyManagers(
        saved.customerCompanyId,
        NotificationType.SHIPMENT_REJECTED,
        `Envío ${saved.trackingCode} rechazado`,
        `El carrier rechazó tu envío. Motivo: ${dto.reason}`,
        {
          shipmentId: saved.id,
          trackingCode: saved.trackingCode,
          reason: dto.reason,
        },
      );
    }
    return saved;
  }

  async cancel(
    id: string,
    reason: string,
    user: IUserPayload,
  ): Promise<Shipment> {
    const shipment = await this.findOne(id, user);

    if (shipment.status === ShipmentStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed shipment');
    }

    // Cliente y carrier pueden cancelar; super_admin también
    const role = this.getShipmentRole(shipment, user);
    if (role === 'none' && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('You cannot cancel this shipment');
    }

    shipment.status = ShipmentStatus.CANCELLED;
    shipment.cancelReason = `[${role}] ${reason}`;
    shipment.cancelledAt = new Date();

    const saved = await this.shipmentRepository.save(shipment);

    // Notificar a la otra parte (si es cross-company)
    const targetCompanyId =
      role === 'carrier' ? saved.customerCompanyId : saved.companyId;
    if (targetCompanyId && targetCompanyId !== user.companyId) {
      await this.notifyCompanyManagers(
        targetCompanyId,
        NotificationType.SHIPMENT_CANCELLED,
        `Envío ${saved.trackingCode} cancelado`,
        `El ${role === 'carrier' ? 'carrier' : 'cliente'} canceló el envío. Motivo: ${reason}`,
        { shipmentId: saved.id, reason },
      );
    }
    return saved;
  }

  // ─────────────────────────────────────────────
  // POD upload — solo carrier
  // ─────────────────────────────────────────────
  async uploadPod(
    id: string,
    dto: UploadPodDto,
    user: IUserPayload,
  ): Promise<Shipment> {
    const shipment = await this.findOne(id, user);
    this.assertCarrierAction(shipment, user);

    if (shipment.status !== ShipmentStatus.DELIVERED) {
      throw new BadRequestException(
        'Cannot upload POD until shipment is delivered',
      );
    }

    shipment.podUrl = dto.podUrl;
    shipment.podSignedBy = dto.podSignedBy || null;
    shipment.podUploadedAt = new Date();
    shipment.status = ShipmentStatus.POD_UPLOADED;

    return this.shipmentRepository.save(shipment);
  }

  // ─────────────────────────────────────────────
  // COMPLETE — solo carrier
  // ─────────────────────────────────────────────
  async complete(id: string, user: IUserPayload): Promise<Shipment> {
    const shipment = await this.findOne(id, user);
    this.assertCarrierAction(shipment, user);

    if (
      shipment.status !== ShipmentStatus.POD_UPLOADED &&
      shipment.status !== ShipmentStatus.DELIVERED
    ) {
      throw new BadRequestException(
        'Shipment must be delivered (and POD uploaded) before completing',
      );
    }

    shipment.status = ShipmentStatus.COMPLETED;
    return this.shipmentRepository.save(shipment);
  }

  async getTimeline(id: string, user: IUserPayload) {
    const shipment = await this.findOne(id, user);
    return {
      shipmentId: shipment.id,
      trackingCode: shipment.trackingCode,
      currentStatus: shipment.status,
      events: [
        { event: 'created', at: shipment.createdAt },
        shipment.proposedAt && {
          event: 'proposed',
          at: shipment.proposedAt,
          by: shipment.proposedBy,
        },
        shipment.acceptedAt && {
          event: 'accepted',
          at: shipment.acceptedAt,
          by: shipment.acceptedBy,
        },
        shipment.rejectedAt && {
          event: 'rejected',
          at: shipment.rejectedAt,
          by: shipment.rejectedBy,
          reason: shipment.rejectionReason,
        },
        shipment.pickedUpAt && { event: 'picked_up', at: shipment.pickedUpAt },
        shipment.deliveredAt && {
          event: 'delivered',
          at: shipment.deliveredAt,
        },
        shipment.podUploadedAt && {
          event: 'pod_uploaded',
          at: shipment.podUploadedAt,
        },
        shipment.cancelledAt && {
          event: 'cancelled',
          at: shipment.cancelledAt,
          reason: shipment.cancelReason,
        },
      ].filter(Boolean),
    };
  }

  async remove(id: string, user: IUserPayload): Promise<void> {
    const shipment = await this.findOne(id, user);
    if (
      shipment.status !== ShipmentStatus.DRAFT &&
      shipment.status !== ShipmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Only draft or cancelled shipments can be deleted',
      );
    }
    await this.shipmentRepository.softRemove(shipment);
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  private requireCompanyId(user: IUserPayload): string {
    if (!user.companyId) {
      throw new ForbiddenException('User has no company associated');
    }
    return user.companyId;
  }

  private assertTenantAccess(shipment: Shipment, user: IUserPayload): void {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (
      shipment.companyId !== user.companyId &&
      shipment.customerCompanyId !== user.companyId
    ) {
      throw new ForbiddenException('You do not have access to this shipment');
    }
  }

  /**
   * Determina el rol del usuario sobre un shipment específico.
   * - 'carrier' si user.companyId === shipment.companyId (ejecuta el envío)
   * - 'customer' si user.companyId === shipment.customerCompanyId (originó la carga)
   * - 'none' si no tiene relación (super_admin debe tratarse aparte)
   */
  private getShipmentRole(
    shipment: Shipment,
    user: IUserPayload,
  ): 'carrier' | 'customer' | 'none' {
    if (user.role === UserRole.SUPER_ADMIN) return 'carrier';
    if (shipment.companyId === user.companyId) return 'carrier';
    if (shipment.customerCompanyId === user.companyId) return 'customer';
    return 'none';
  }

  /**
   * Asegura que el usuario actúa como carrier sobre este shipment.
   * Driver también puede para cambios de status operativos.
   */
  private assertCarrierAction(shipment: Shipment, user: IUserPayload): void {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (shipment.companyId !== user.companyId) {
      throw new ForbiddenException(
        'Only the carrier company can perform this action',
      );
    }
  }

  /**
   * Valida que el truck y/o driver provistos pertenezcan a la empresa carrier.
   * Lanza BadRequestException con detalle si alguno no pertenece.
   */
  private async validateResourcesBelongToCarrier(
    carrierCompanyId: string,
    truckId: string | null | undefined,
    driverId: string | null | undefined,
  ): Promise<void> {
    if (truckId) {
      const truck = await this.truckRepository.findOne({
        where: { id: truckId },
        select: ['id', 'companyId'],
      });
      if (!truck) {
        throw new BadRequestException(`Truck ${truckId} not found`);
      }
      if (truck.companyId !== carrierCompanyId) {
        throw new ForbiddenException(
          `Truck ${truckId} does not belong to carrier ${carrierCompanyId}`,
        );
      }
    }
    if (driverId) {
      const driver = await this.driverRepository.findOne({
        where: { id: driverId },
        select: ['id', 'companyId'],
      });
      if (!driver) {
        throw new BadRequestException(`Driver ${driverId} not found`);
      }
      if (driver.companyId !== carrierCompanyId) {
        throw new ForbiddenException(
          `Driver ${driverId} does not belong to carrier ${carrierCompanyId}`,
        );
      }
    }
  }

  /**
   * Notifica a todos los usuarios "managers" (owner, admin, manager, dispatcher)
   * de una empresa. Best-effort: si falla la notificación NO rompe la operación
   * principal; solo loggea.
   */
  private async notifyCompanyManagers(
    companyId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      const managers = await this.userRepository.find({
        where: {
          companyId,
          role: In(MANAGEMENT_ROLES),
        },
        select: ['id'],
      });
      await Promise.all(
        managers.map((u) =>
          this.notificationsService.create({
            userId: u.id,
            type,
            title,
            body,
            data,
          }),
        ),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to notify managers of company ${companyId}: ${(err as Error).message}`,
      );
    }
  }

  private async generateTrackingCode(companyId: string): Promise<string> {
    // formato: SHP-{timestamp36}-{rand}
    for (let i = 0; i < 5; i++) {
      const code =
        'SHP-' +
        Date.now().toString(36).toUpperCase() +
        '-' +
        Math.random().toString(36).slice(2, 6).toUpperCase();
      const exists = await this.shipmentRepository.findOne({
        where: { companyId, trackingCode: code },
      });
      if (!exists) return code;
    }
    throw new ConflictException('Could not generate unique tracking code');
  }

  private assertValidTransition(
    from: ShipmentStatus,
    to: ShipmentStatus,
  ): void {
    const allowed: Record<ShipmentStatus, ShipmentStatus[]> = {
      [ShipmentStatus.PENDING_ACCEPTANCE]: [
        ShipmentStatus.CONFIRMED,
        ShipmentStatus.CANCELLED,
      ],
      [ShipmentStatus.DRAFT]: [
        ShipmentStatus.QUOTED,
        ShipmentStatus.CONFIRMED,
        ShipmentStatus.CANCELLED,
      ],
      [ShipmentStatus.QUOTED]: [
        ShipmentStatus.CONFIRMED,
        ShipmentStatus.CANCELLED,
      ],
      [ShipmentStatus.CONFIRMED]: [
        ShipmentStatus.ASSIGNED,
        ShipmentStatus.CANCELLED,
      ],
      [ShipmentStatus.ASSIGNED]: [
        ShipmentStatus.PICKED_UP,
        ShipmentStatus.CANCELLED,
        ShipmentStatus.INCIDENT,
      ],
      [ShipmentStatus.PICKED_UP]: [
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.AT_STOP,
        ShipmentStatus.INCIDENT,
      ],
      [ShipmentStatus.IN_TRANSIT]: [
        ShipmentStatus.AT_STOP,
        ShipmentStatus.DELIVERED,
        ShipmentStatus.INCIDENT,
      ],
      [ShipmentStatus.AT_STOP]: [
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.DELIVERED,
        ShipmentStatus.INCIDENT,
      ],
      [ShipmentStatus.DELIVERED]: [
        ShipmentStatus.POD_UPLOADED,
        ShipmentStatus.COMPLETED,
      ],
      [ShipmentStatus.POD_UPLOADED]: [ShipmentStatus.COMPLETED],
      [ShipmentStatus.INCIDENT]: [
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.CANCELLED,
        ShipmentStatus.COMPLETED,
      ],
      [ShipmentStatus.COMPLETED]: [],
      [ShipmentStatus.CANCELLED]: [],
    };

    if (!allowed[from]?.includes(to)) {
      throw new BadRequestException(
        `Invalid status transition: ${from} -> ${to}`,
      );
    }
  }

  /**
   * Verifica que la empresa no haya superado su límite diario de envíos.
   * - Sin suscripción activa → aplica 6 (free tier por defecto).
   * - Con suscripción → lee global.maxShipmentsPerDay del jsonb del plan.
   * - Valor 99999 o -1 se trata como ilimitado.
   */
  private async checkDailyShipmentLimit(companyId: string): Promise<void> {
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

    let maxPerDay: number;

    if (rows.length === 0) {
      maxPerDay = 6;
    } else {
      const resolved = rows[0].limits?.['global']?.['maxShipmentsPerDay'];
      if (resolved === undefined || resolved === -1 || resolved >= 99999) {
        return; // ilimitado
      }
      maxPerDay = resolved;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const countToday = await this.shipmentRepository
      .createQueryBuilder('s')
      .where('s.companyId = :companyId', { companyId })
      .andWhere('s.createdAt >= :today', { today })
      .andWhere('s.createdAt < :tomorrow', { tomorrow })
      .andWhere('s.deletedAt IS NULL')
      .getCount();

    if (countToday >= maxPerDay) {
      throw new ForbiddenException(
        `Has alcanzado el límite de ${maxPerDay} envío(s) por día en tu plan actual. Considera mejorar tu plan.`,
      );
    }
  }
}
