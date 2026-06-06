import { ProximityAlertService } from './proximity-alert.service';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';

const COMPANY_ID = 'company-a';
const DRIVER_ID = 'driver-1';
const USER_ID = 'user-1';

function makePoint(overrides: Partial<any> = {}): any {
  return {
    id: 'tp-1',
    companyId: COMPANY_ID,
    driverId: DRIVER_ID,
    lat: '-33.4372',
    lng: '-70.6506',
    capturedAt: new Date(),
    ...overrides,
  };
}

function makeShipment(overrides: Partial<any> = {}): any {
  return {
    id: 'ship-1',
    driverId: DRIVER_ID,
    companyId: COMPANY_ID,
    status: ShipmentStatus.IN_TRANSIT,
    proximityAlertSentAt: null,
    destinationContactPhone: '+56912345678',
    destinationLat: '-33.4372',
    destinationLng: '-70.6506',
    destinationAddress: 'Av. Providencia 1234, Santiago',
    publicTrackingToken: 'tok-abc123',
    ...overrides,
  };
}

describe('ProximityAlertService', () => {
  let service: ProximityAlertService;
  let shipmentRepo: any;
  let whatsapp: any;
  let notificationsService: any;
  let permissionsCache: any;
  let dataSource: any;
  let config: any;

  beforeEach(() => {
    shipmentRepo = {
      createQueryBuilder: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };

    whatsapp = {
      sendProximityAlert: jest.fn().mockResolvedValue(undefined),
    };

    notificationsService = {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    permissionsCache = {
      getOrLoad: jest.fn(),
    };

    dataSource = {
      query: jest.fn(),
    };

    config = {
      get: jest.fn().mockImplementation((key: string, def: any) => def),
    };

    service = new ProximityAlertService(
      shipmentRepo,
      whatsapp,
      notificationsService,
      permissionsCache,
      dataSource,
      config,
    );
  });

  // ── Permission gate ───────────────────────────────────────────
  describe('permission gate', () => {
    it('silently skips when company lacks tracking.proximity_alerts', async () => {
      permissionsCache.getOrLoad.mockResolvedValue(['tracking.public_link']);

      await service.handleLocationUpdate(makePoint());

      expect(shipmentRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(whatsapp.sendProximityAlert).not.toHaveBeenCalled();
    });

    it('skips when point has no driverId', async () => {
      await service.handleLocationUpdate(makePoint({ driverId: null }));

      expect(permissionsCache.getOrLoad).not.toHaveBeenCalled();
    });

    it('skips when point has no companyId', async () => {
      await service.handleLocationUpdate(makePoint({ companyId: null }));

      expect(permissionsCache.getOrLoad).not.toHaveBeenCalled();
    });
  });

  // ── Query scope ──────────────────────────────────────────────
  describe('query scope', () => {
    function mockQbWithShipments(shipments: any[]) {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(shipments),
      };
      shipmentRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    beforeEach(() => {
      permissionsCache.getOrLoad.mockResolvedValue([
        'tracking.proximity_alerts',
      ]);
    });

    it('filters by driverId — not a full table scan', async () => {
      const qb = mockQbWithShipments([]);

      await service.handleLocationUpdate(makePoint());

      expect(qb.where).toHaveBeenCalledWith('s.driverId = :driverId', {
        driverId: DRIVER_ID,
      });
    });

    it('skips shipments with invalid coordinates', async () => {
      mockQbWithShipments([
        makeShipment({ destinationLat: 'NaN', destinationLng: 'NaN' }),
      ]);

      await service.handleLocationUpdate(makePoint());

      expect(whatsapp.sendProximityAlert).not.toHaveBeenCalled();
    });
  });

  // ── Proximity logic ──────────────────────────────────────────
  describe('proximity detection', () => {
    beforeEach(() => {
      permissionsCache.getOrLoad.mockResolvedValue([
        'tracking.proximity_alerts',
      ]);
    });

    it('sends WhatsApp + push when driver is within threshold', async () => {
      // Same coordinates = 0m distance → within threshold
      const shipment = makeShipment({
        destinationLat: '-33.4372',
        destinationLng: '-70.6506',
      });
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([shipment]),
      };
      shipmentRepo.createQueryBuilder.mockReturnValue(qb);
      dataSource.query.mockResolvedValueOnce([{ user_id: USER_ID }]); // driver lookup

      const point = makePoint({ lat: '-33.4372', lng: '-70.6506' });
      await service.handleLocationUpdate(point);

      expect(shipmentRepo.update).toHaveBeenCalledWith(shipment.id, {
        proximityAlertSentAt: expect.any(Date),
      });
      expect(whatsapp.sendProximityAlert).toHaveBeenCalledWith(
        shipment.destinationContactPhone,
        shipment.publicTrackingToken,
        shipment.destinationAddress,
      );
    });

    it('does NOT send when driver is far (>500m)', async () => {
      // Point in Santiago centro, destination in Providencia ~3km away
      const shipment = makeShipment({
        destinationLat: '-33.4264', // ~3km north
        destinationLng: '-70.6068',
      });
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([shipment]),
      };
      shipmentRepo.createQueryBuilder.mockReturnValue(qb);

      const point = makePoint({ lat: '-33.4569', lng: '-70.6483' });
      await service.handleLocationUpdate(point);

      expect(shipmentRepo.update).not.toHaveBeenCalled();
      expect(whatsapp.sendProximityAlert).not.toHaveBeenCalled();
    });

    it('skips already-alerted shipments (proximityAlertSentAt set)', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]), // DB filters them out
      };
      shipmentRepo.createQueryBuilder.mockReturnValue(qb);

      await service.handleLocationUpdate(makePoint());

      expect(whatsapp.sendProximityAlert).not.toHaveBeenCalled();
    });
  });

  // ── Push notification ─────────────────────────────────────────
  describe('driver push notification', () => {
    beforeEach(() => {
      permissionsCache.getOrLoad.mockResolvedValue([
        'tracking.proximity_alerts',
      ]);
    });

    it('creates in-app push with PROXIMITY_ALERT type', async () => {
      const shipment = makeShipment({
        destinationLat: '-33.4372',
        destinationLng: '-70.6506',
      });
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([shipment]),
      };
      shipmentRepo.createQueryBuilder.mockReturnValue(qb);
      dataSource.query.mockResolvedValue([{ user_id: USER_ID }]);

      await service.handleLocationUpdate(
        makePoint({ lat: '-33.4372', lng: '-70.6506' }),
      );

      // Wait for async push (fired with .catch)
      await new Promise((r) => setTimeout(r, 10));

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          type: NotificationType.PROXIMITY_ALERT,
        }),
      );
    });

    it('skips push silently when driver has no userId', async () => {
      const shipment = makeShipment({
        destinationLat: '-33.4372',
        destinationLng: '-70.6506',
      });
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([shipment]),
      };
      shipmentRepo.createQueryBuilder.mockReturnValue(qb);
      dataSource.query.mockResolvedValue([]); // no userId found

      await service.handleLocationUpdate(
        makePoint({ lat: '-33.4372', lng: '-70.6506' }),
      );
      await new Promise((r) => setTimeout(r, 10));

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  // ── Permission loader ─────────────────────────────────────────
  describe('loadCompanyPermissions (via getOrLoad loader)', () => {
    it('calls dataSource.query when cache is cold', async () => {
      permissionsCache.getOrLoad.mockImplementation(
        async (_id: string, loader: () => Promise<string[]>) => loader(),
      );
      dataSource.query
        .mockResolvedValueOnce([
          { code: 'tracking.proximity_alerts' },
          { code: 'tracking.public_link' },
        ])
        .mockResolvedValue([]); // driver lookup returns nothing

      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      shipmentRepo.createQueryBuilder.mockReturnValue(qb);

      await service.handleLocationUpdate(makePoint());

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('subscriptions'),
        [COMPANY_ID],
      );
    });
  });
});
