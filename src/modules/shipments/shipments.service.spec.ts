import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { Shipment } from './entities/shipment.entity';
import { Truck } from '../trucks/entities/truck.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { User } from '../auth/entities/user.entity';
import { RelationshipsService } from '../relationships/relationships.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const qbMock = (data: unknown[] = [], total = 0) => {
  const q: Record<string, jest.Mock> = {};
  ['where', 'andWhere', 'orderBy', 'skip', 'take'].forEach(
    (m) => (q[m] = jest.fn().mockReturnThis()),
  );
  q.getManyAndCount = jest.fn().mockResolvedValue([data, total]);
  return q;
};

const repoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 's1', ...x })),
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  softRemove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const carrierUser = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'carrier1' }) as never;
const customerUser = (): IUserPayload =>
  ({ sub: 'u2', role: UserRole.ADMIN, companyId: 'customer1' }) as never;
const strangerUser = (): IUserPayload =>
  ({ sub: 'u3', role: UserRole.ADMIN, companyId: 'stranger' }) as never;
const admin = (): IUserPayload =>
  ({ sub: 'a', role: UserRole.SUPER_ADMIN, companyId: null }) as never;

describe('ShipmentsService', () => {
  let service: ShipmentsService;
  let shipmentRepo: ReturnType<typeof repoMock>;
  let truckRepo: ReturnType<typeof repoMock>;
  let driverRepo: ReturnType<typeof repoMock>;
  let userRepo: ReturnType<typeof repoMock>;
  let relationships: { isActiveBetween: jest.Mock };
  let notifications: { create: jest.Mock };

  beforeEach(async () => {
    shipmentRepo = repoMock();
    truckRepo = repoMock();
    driverRepo = repoMock();
    userRepo = repoMock();
    relationships = { isActiveBetween: jest.fn().mockResolvedValue(true) };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: getRepositoryToken(Shipment), useValue: shipmentRepo },
        { provide: getRepositoryToken(Truck), useValue: truckRepo },
        { provide: getRepositoryToken(Driver), useValue: driverRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: RelationshipsService, useValue: relationships },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = module.get(ShipmentsService);
  });

  it('is defined', () => expect(service).toBeDefined());

  // ─────────────────────────── CREATE ───────────────────────────
  describe('create', () => {
    it('single-company DRAFT shipment', async () => {
      shipmentRepo.findOne.mockResolvedValue(null); // tracking code unique
      const res = await service.create({} as never, carrierUser());
      expect(res.status).toBe(ShipmentStatus.DRAFT);
      expect(res.companyId).toBe('carrier1');
      expect(relationships.isActiveBetween).not.toHaveBeenCalled();
    });

    it('cross-company creator must be customer or carrier', async () => {
      await expect(
        service.create(
          {
            customerCompanyId: 'customer1',
            proposedCarrierId: 'carrier1',
          } as never,
          strangerUser(), // neither customer nor carrier
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cross-company without active relationship -> Forbidden', async () => {
      relationships.isActiveBetween.mockResolvedValueOnce(false);
      await expect(
        service.create(
          {
            customerCompanyId: 'customer1',
            proposedCarrierId: 'carrier1',
          } as never,
          customerUser(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cross-company creator=customer -> PENDING_ACCEPTANCE + notifies managers', async () => {
      shipmentRepo.findOne.mockResolvedValue(null);
      userRepo.find.mockResolvedValueOnce([{ id: 'mgr1' }, { id: 'mgr2' }]);
      const res = await service.create(
        {
          customerCompanyId: 'customer1',
          proposedCarrierId: 'carrier1',
        } as never,
        customerUser(),
      );
      expect(res.status).toBe(ShipmentStatus.PENDING_ACCEPTANCE);
      expect(notifications.create).toHaveBeenCalledTimes(2);
    });

    it('cross-company creator=carrier -> DRAFT (no notify)', async () => {
      shipmentRepo.findOne.mockResolvedValue(null);
      const res = await service.create(
        { customerCompanyId: 'customer1' } as never,
        carrierUser(),
      );
      expect(res.status).toBe(ShipmentStatus.DRAFT);
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('validates truck/driver pertenencia at create', async () => {
      shipmentRepo.findOne.mockResolvedValue(null);
      truckRepo.findOne.mockResolvedValue({
        id: 'tk',
        companyId: 'OTHER',
      });
      await expect(
        service.create({ truckId: 'tk' } as never, carrierUser()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when truck not found', async () => {
      shipmentRepo.findOne.mockResolvedValue(null);
      truckRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ truckId: 'tk' } as never, carrierUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─────────────────────────── FIND ALL ───────────────────────────
  describe('findAll', () => {
    it('tenant: filters by companyId OR customerCompanyId', async () => {
      const qb = qbMock([], 0);
      shipmentRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(
        { skip: 0, limit: 10, page: 1 } as never,
        carrierUser(),
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(shipment.companyId = :companyId OR shipment.customerCompanyId = :companyId)',
        { companyId: 'carrier1' },
      );
    });

    it('SUPER_ADMIN with all filters', async () => {
      const qb = qbMock([{ id: 's1' }], 1);
      shipmentRepo.createQueryBuilder.mockReturnValue(qb);
      const res = await service.findAll(
        {
          skip: 0,
          limit: 10,
          page: 1,
          companyId: 'cZ',
          search: 'foo',
          status: ShipmentStatus.DRAFT,
          priority: 'high',
          driverId: 'd1',
          truckId: 't1',
          routeId: 'r1',
          customerCompanyId: 'cc1',
          pickupFrom: '2024-01-01',
          pickupTo: '2024-12-31',
          sortBy: 'pickupAt',
          sortOrder: 'ASC',
        } as never,
        admin(),
      );
      expect(res.meta.total).toBe(1);
      expect(qb.orderBy).toHaveBeenCalledWith('shipment.pickupAt', 'ASC');
    });
  });

  // ─────────────────────────── FIND ONE / TRACKING ───────────────────────────
  describe('findOne', () => {
    it('NotFound when missing', async () => {
      shipmentRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('x', carrierUser())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('Forbidden if not carrier nor customer', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        customerCompanyId: 'customer1',
      });
      await expect(
        service.findOne('s1', strangerUser()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns when user is customer', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        customerCompanyId: 'customer1',
      });
      const res = await service.findOne('s1', customerUser());
      expect(res.id).toBe('s1');
    });
  });

  describe('findByTrackingCode', () => {
    it('NotFound when not exists', async () => {
      shipmentRepo.findOne.mockResolvedValue(null);
      await expect(service.findByTrackingCode('X')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
    it('returns shipment when exists', async () => {
      shipmentRepo.findOne.mockResolvedValue({ id: 's1' });
      const res = await service.findByTrackingCode('X');
      expect(res.id).toBe('s1');
    });
  });

  // ─────────────────────────── UPDATE ───────────────────────────
  describe('update', () => {
    it('blocks update on COMPLETED', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.COMPLETED,
      });
      await expect(
        service.update('s1', {} as never, carrierUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('PENDING_ACCEPTANCE: only customer can update', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        customerCompanyId: 'customer1',
        status: ShipmentStatus.PENDING_ACCEPTANCE,
      });
      await expect(
        service.update('s1', { description: 'x' } as never, carrierUser()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects fields outside customer scope', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        customerCompanyId: 'customer1',
        status: ShipmentStatus.DRAFT,
      });
      await expect(
        service.update('s1', { price: 100 } as never, customerUser()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('carrier can update price + validates resources', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.DRAFT,
        truckId: null,
        driverId: null,
      });
      truckRepo.findOne.mockResolvedValue({
        id: 'tk',
        companyId: 'carrier1',
      });
      const res = await service.update(
        's1',
        { price: 100, truckId: 'tk' } as never,
        carrierUser(),
      );
      expect(res).toMatchObject({ price: 100, truckId: 'tk' });
    });
  });

  // ─────────────────────────── UPDATE STATUS ───────────────────────────
  describe('updateStatus', () => {
    it('rejects PENDING_ACCEPTANCE source', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.PENDING_ACCEPTANCE,
      });
      await expect(
        service.updateStatus('s1', ShipmentStatus.CONFIRMED, carrierUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects invalid transition', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.DRAFT,
      });
      await expect(
        service.updateStatus('s1', ShipmentStatus.DELIVERED, carrierUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('valid transition + sets pickedUpAt', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        customerCompanyId: null,
        status: ShipmentStatus.ASSIGNED,
        trackingCode: 'SHP-X',
      });
      const res = await service.updateStatus(
        's1',
        ShipmentStatus.PICKED_UP,
        carrierUser(),
      );
      expect(res.pickedUpAt).toBeInstanceOf(Date);
      expect(res.status).toBe(ShipmentStatus.PICKED_UP);
    });

    it('notifies customer on cross-company status change', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        customerCompanyId: 'customer1',
        status: ShipmentStatus.IN_TRANSIT,
        trackingCode: 'SHP-X',
      });
      userRepo.find.mockResolvedValueOnce([{ id: 'mgr1' }]);
      await service.updateStatus('s1', ShipmentStatus.DELIVERED, carrierUser());
      expect(notifications.create).toHaveBeenCalledTimes(1);
    });

    it('non-carrier cannot updateStatus', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        customerCompanyId: 'customer1',
        status: ShipmentStatus.ASSIGNED,
      });
      await expect(
        service.updateStatus('s1', ShipmentStatus.PICKED_UP, customerUser()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─────────────────────────── ASSIGN ───────────────────────────
  describe('assign', () => {
    it('blocked when PENDING_ACCEPTANCE', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.PENDING_ACCEPTANCE,
      });
      await expect(
        service.assign('s1', { truckId: 'tk' } as never, carrierUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('confirmed + truck + driver -> ASSIGNED', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.CONFIRMED,
        truckId: null,
        driverId: null,
      });
      truckRepo.findOne.mockResolvedValue({
        id: 'tk',
        companyId: 'carrier1',
      });
      driverRepo.findOne.mockResolvedValue({
        id: 'dr',
        companyId: 'carrier1',
      });
      const res = await service.assign(
        's1',
        { truckId: 'tk', driverId: 'dr' } as never,
        carrierUser(),
      );
      expect(res.status).toBe(ShipmentStatus.ASSIGNED);
    });
  });

  // ─────────────────────────── ACCEPT / REJECT ───────────────────────────
  describe('accept', () => {
    it('rejects when not PENDING_ACCEPTANCE', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.DRAFT,
      });
      await expect(
        service.accept('s1', {} as never, carrierUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts and notifies customer', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        customerCompanyId: 'customer1',
        status: ShipmentStatus.PENDING_ACCEPTANCE,
        trackingCode: 'SHP-X',
        notes: null,
      });
      userRepo.find.mockResolvedValueOnce([{ id: 'mgr' }]);
      const res = await service.accept(
        's1',
        { notes: 'ok' } as never,
        carrierUser(),
      );
      expect(res.status).toBe(ShipmentStatus.CONFIRMED);
      expect(res.acceptedBy).toBe('u1');
      expect(notifications.create).toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('rejects when not PENDING_ACCEPTANCE', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.DRAFT,
      });
      await expect(
        service.reject('s1', { reason: 'no' } as never, carrierUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects shipment, notifies customer', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        customerCompanyId: 'customer1',
        status: ShipmentStatus.PENDING_ACCEPTANCE,
        trackingCode: 'SHP-X',
      });
      userRepo.find.mockResolvedValueOnce([{ id: 'mgr' }]);
      const res = await service.reject(
        's1',
        { reason: 'busy' } as never,
        carrierUser(),
      );
      expect(res.status).toBe(ShipmentStatus.CANCELLED);
      expect(res.rejectionReason).toBe('busy');
      expect(notifications.create).toHaveBeenCalled();
    });
  });

  // ─────────────────────────── CANCEL ───────────────────────────
  describe('cancel', () => {
    it('blocks cancel when COMPLETED', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.COMPLETED,
      });
      await expect(
        service.cancel('s1', 'why', carrierUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cross-company cancel by carrier notifies customer', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        customerCompanyId: 'customer1',
        status: ShipmentStatus.CONFIRMED,
        trackingCode: 'SHP-X',
      });
      userRepo.find.mockResolvedValueOnce([{ id: 'mgr' }]);
      const res = await service.cancel('s1', 'oops', carrierUser());
      expect(res.status).toBe(ShipmentStatus.CANCELLED);
      expect(notifications.create).toHaveBeenCalled();
    });
  });

  // ─────────────────────────── POD / COMPLETE ───────────────────────────
  describe('uploadPod', () => {
    it('rejects if not DELIVERED', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.IN_TRANSIT,
      });
      await expect(
        service.uploadPod('s1', { podUrl: 'u' } as never, carrierUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('uploads pod and switches to POD_UPLOADED', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.DELIVERED,
      });
      const res = await service.uploadPod(
        's1',
        { podUrl: 'u', podSignedBy: 'X' } as never,
        carrierUser(),
      );
      expect(res.status).toBe(ShipmentStatus.POD_UPLOADED);
      expect(res.podUrl).toBe('u');
    });
  });

  describe('complete', () => {
    it('rejects when not delivered/pod', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.IN_TRANSIT,
      });
      await expect(
        service.complete('s1', carrierUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('completes from POD_UPLOADED', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.POD_UPLOADED,
      });
      const res = await service.complete('s1', carrierUser());
      expect(res.status).toBe(ShipmentStatus.COMPLETED);
    });
  });

  // ─────────────────────────── TIMELINE / REMOVE ───────────────────────────
  describe('getTimeline', () => {
    it('returns filtered events', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        trackingCode: 'SHP-X',
        status: ShipmentStatus.DELIVERED,
        createdAt: new Date('2024-01-01'),
        proposedAt: null,
        acceptedAt: new Date('2024-01-02'),
        acceptedBy: 'u1',
        rejectedAt: null,
        pickedUpAt: new Date('2024-01-03'),
        deliveredAt: new Date('2024-01-04'),
        podUploadedAt: null,
        cancelledAt: null,
      });
      const tl = await service.getTimeline('s1', carrierUser());
      expect(tl.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ event: 'created' }),
          expect.objectContaining({ event: 'accepted' }),
          expect.objectContaining({ event: 'picked_up' }),
          expect.objectContaining({ event: 'delivered' }),
        ]),
      );
      expect(
        tl.events.some(
          (e) =>
            e &&
            typeof e === 'object' &&
            'event' in e &&
            (e as { event: string }).event === 'rejected',
        ),
      ).toBe(false);
    });
  });

  describe('remove', () => {
    it('blocks delete on non-draft/non-cancelled', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.IN_TRANSIT,
      });
      await expect(service.remove('s1', carrierUser())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('soft removes draft', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        status: ShipmentStatus.DRAFT,
      });
      await service.remove('s1', carrierUser());
      expect(shipmentRepo.softRemove).toHaveBeenCalled();
    });
  });

  // ─────────────────────────── notifyCompanyManagers safety ───────────────────────────
  describe('notify failure swallowed', () => {
    it('does not throw if notifications.create fails', async () => {
      shipmentRepo.findOne.mockResolvedValue({
        id: 's1',
        companyId: 'carrier1',
        customerCompanyId: 'customer1',
        status: ShipmentStatus.IN_TRANSIT,
        trackingCode: 'SHP-X',
      });
      userRepo.find.mockResolvedValueOnce([{ id: 'mgr' }]);
      notifications.create.mockRejectedValueOnce(new Error('boom'));
      // should not throw
      const res = await service.updateStatus(
        's1',
        ShipmentStatus.DELIVERED,
        carrierUser(),
      );
      expect(res.status).toBe(ShipmentStatus.DELIVERED);
    });
  });
});
