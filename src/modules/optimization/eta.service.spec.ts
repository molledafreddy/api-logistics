import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EtaService } from './eta.service';
import { DeliveryRunStatus } from '../../common/enums/delivery-run-status.enum';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';

describe('EtaService', () => {
  const COMPANY = 'co1';
  let service: EtaService;
  let runRepo: any;
  let shipmentRepo: any;
  let trackingRepo: any;

  function userManager(): any {
    return { sub: 'u', role: UserRole.MANAGER, companyId: COMPANY };
  }

  beforeEach(() => {
    runRepo = { findOne: jest.fn() };
    shipmentRepo = { find: jest.fn().mockResolvedValue([]) };
    trackingRepo = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      })),
    };
    service = new EtaService(runRepo, shipmentRepo, trackingRepo);
  });

  it('404 si run no existe', async () => {
    runRepo.findOne.mockResolvedValue(null);
    await expect(service.computeLive('r1', userManager())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('Forbidden si companyId no coincide', async () => {
    runRepo.findOne.mockResolvedValue({ id: 'r1', companyId: 'other' });
    await expect(service.computeLive('r1', userManager())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('run sin secuencia → respuesta vacía con origin=unknown', async () => {
    runRepo.findOne.mockResolvedValue({
      id: 'r1',
      companyId: COMPANY,
      optimizedSequence: [],
      status: DeliveryRunStatus.PLANNED,
    });
    const r = await service.computeLive('r1', userManager());
    expect(r.stops).toEqual([]);
    expect(r.origin.source).toBe('unknown');
  });

  it('PLANNED sin GPS: usa primer stop como ancla, ETAs=null pero distancias OK', async () => {
    runRepo.findOne.mockResolvedValue({
      id: 'r1',
      companyId: COMPANY,
      status: DeliveryRunStatus.PLANNED,
      optimizedSequence: ['s1', 's2'],
      truckId: null,
    });
    shipmentRepo.find.mockResolvedValue([
      {
        id: 's1',
        status: ShipmentStatus.CONFIRMED,
        destinationLat: '0',
        destinationLng: '0',
      },
      {
        id: 's2',
        status: ShipmentStatus.CONFIRMED,
        destinationLat: '0',
        destinationLng: '1',
      },
    ]);
    const r = await service.computeLive('r1', userManager());
    expect(r.origin.source).toBe('first_stop');
    expect(r.stops).toHaveLength(2);
    expect(r.stops[0].etaAt).toBeNull();
    expect(r.stops[1].remainingDistanceKm).toBeGreaterThan(100);
  });

  it('IN_PROGRESS con GPS reciente → ETAs reales', async () => {
    runRepo.findOne.mockResolvedValue({
      id: 'r1',
      companyId: COMPANY,
      status: DeliveryRunStatus.IN_PROGRESS,
      optimizedSequence: ['s1', 's2'],
      truckId: 't1',
    });
    shipmentRepo.find.mockResolvedValue([
      {
        id: 's1',
        status: ShipmentStatus.IN_TRANSIT,
        destinationLat: '0',
        destinationLng: '1',
      },
      {
        id: 's2',
        status: ShipmentStatus.IN_TRANSIT,
        destinationLat: '0',
        destinationLng: '2',
      },
    ]);
    trackingRepo.createQueryBuilder = jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        lat: '0',
        lng: '0',
        capturedAt: new Date(),
      }),
    }));

    const r = await service.computeLive('r1', userManager());
    expect(r.origin.source).toBe('gps');
    expect(r.stops[0].etaAt).toBeInstanceOf(Date);
    expect(r.stops[1].etaAt).toBeInstanceOf(Date);
    // El segundo ETA debe ser posterior al primero
    expect(r.stops[1].etaAt!.getTime()).toBeGreaterThan(
      r.stops[0].etaAt!.getTime(),
    );
  });

  it('shipments DELIVERED se marcan completed con etaAt=null', async () => {
    runRepo.findOne.mockResolvedValue({
      id: 'r1',
      companyId: COMPANY,
      status: DeliveryRunStatus.IN_PROGRESS,
      optimizedSequence: ['s1', 's2'],
      truckId: 't1',
    });
    shipmentRepo.find.mockResolvedValue([
      {
        id: 's1',
        status: ShipmentStatus.DELIVERED,
        destinationLat: '0',
        destinationLng: '1',
      },
      {
        id: 's2',
        status: ShipmentStatus.IN_TRANSIT,
        destinationLat: '0',
        destinationLng: '2',
      },
    ]);
    trackingRepo.createQueryBuilder = jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        lat: '0',
        lng: '0',
        capturedAt: new Date(),
      }),
    }));
    const r = await service.computeLive('r1', userManager());
    expect(r.stops[0].state).toBe('completed');
    expect(r.stops[0].etaAt).toBeNull();
    expect(r.stops[1].state).toBe('pending');
    expect(r.stops[1].etaAt).toBeInstanceOf(Date);
  });

  it('GPS expirado (>30 min) → cae a primer stop', async () => {
    runRepo.findOne.mockResolvedValue({
      id: 'r1',
      companyId: COMPANY,
      status: DeliveryRunStatus.IN_PROGRESS,
      optimizedSequence: ['s1'],
      truckId: 't1',
    });
    shipmentRepo.find.mockResolvedValue([
      {
        id: 's1',
        status: ShipmentStatus.IN_TRANSIT,
        destinationLat: '0',
        destinationLng: '1',
      },
    ]);
    const stale = new Date(Date.now() - 1000 * 60 * 60); // 1h atrás
    trackingRepo.createQueryBuilder = jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        lat: '0',
        lng: '0',
        capturedAt: stale,
      }),
    }));
    const r = await service.computeLive('r1', userManager());
    expect(r.origin.source).toBe('first_stop');
  });
});
