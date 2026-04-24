import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OptimizationService } from './optimization.service';
import { HaversineOptimizer } from './strategies/haversine.optimizer';
import { GoogleRoutesOptimizer } from './strategies/google-routes.optimizer';
import { DeliveryRunStatus } from '../../common/enums/delivery-run-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';

describe('OptimizationService', () => {
  const COMPANY = 'co-1';
  let service: OptimizationService;
  let runRepo: any;
  let shipmentRepo: any;
  let haversine: HaversineOptimizer;
  let googleRoutes: any;
  let config: any;
  let emitter: EventEmitter2;

  function userManager(): any {
    return { sub: 'u1', role: UserRole.MANAGER, companyId: COMPANY };
  }

  function makeRun(overrides: Partial<any> = {}) {
    return {
      id: 'r1',
      companyId: COMPANY,
      status: DeliveryRunStatus.PLANNED,
      optimizedSequence: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    runRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (r: any) => r),
    };
    shipmentRepo = { find: jest.fn() };
    haversine = new HaversineOptimizer();
    googleRoutes = { providerName: 'google_routes', optimize: jest.fn() };
    config = { get: jest.fn().mockReturnValue(undefined) };
    emitter = new EventEmitter2();

    service = new OptimizationService(
      runRepo,
      shipmentRepo,
      haversine,
      googleRoutes as GoogleRoutesOptimizer,
      config,
      emitter,
    );
  });

  it('404 si run no existe', async () => {
    runRepo.findOne.mockResolvedValue(null);
    await expect(service.optimizeRun('r1', {}, userManager())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('OPT-003 — usuario de otra empresa no puede optimizar', async () => {
    runRepo.findOne.mockResolvedValue(makeRun());
    await expect(
      service.optimizeRun('r1', {}, {
        sub: 'u2',
        role: UserRole.MANAGER,
        companyId: 'other',
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('OPT-001 — rechaza si status=in_progress', async () => {
    runRepo.findOne.mockResolvedValue(
      makeRun({ status: DeliveryRunStatus.IN_PROGRESS }),
    );
    shipmentRepo.find.mockResolvedValue([]);
    await expect(service.optimizeRun('r1', {}, userManager())).rejects.toThrow(
      /OPT-001/,
    );
  });

  it('OPT-002 — rechaza si menos de 2 shipments', async () => {
    runRepo.findOne.mockResolvedValue(makeRun());
    shipmentRepo.find.mockResolvedValue([
      {
        id: 's1',
        destinationLat: '40',
        destinationLng: '-74',
      },
    ]);
    await expect(service.optimizeRun('r1', {}, userManager())).rejects.toThrow(
      /OPT-002/,
    );
  });

  it('OPT-002 — rechaza si shipments no tienen coords', async () => {
    runRepo.findOne.mockResolvedValue(makeRun());
    shipmentRepo.find.mockResolvedValue([
      { id: 's1', destinationLat: null, destinationLng: null },
      { id: 's2', destinationLat: null, destinationLng: null },
    ]);
    await expect(service.optimizeRun('r1', {}, userManager())).rejects.toThrow(
      /OPT-002/,
    );
  });

  it('haversine default: optimiza, persiste y emite evento', async () => {
    runRepo.findOne.mockResolvedValue(makeRun());
    shipmentRepo.find.mockResolvedValue([
      {
        id: 's1',
        destinationLat: '0',
        destinationLng: '3',
        originLat: '0',
        originLng: '0',
      },
      { id: 's2', destinationLat: '0', destinationLng: '1' },
      { id: 's3', destinationLat: '0', destinationLng: '5' },
    ]);

    const emitSpy = jest.spyOn(emitter, 'emit');
    const result = await service.optimizeRun('r1', {}, userManager());

    // nearest neighbor desde origen (0,0): s2 → s1 → s3
    expect(result.optimizedSequence).toEqual(['s2', 's1', 's3']);
    expect(result.optimizationProvider).toBe('haversine');
    expect(result.optimizedAt).toBeInstanceOf(Date);
    expect(result.etaPerStop).toHaveLength(3);
    expect(Number(result.estimatedDistanceKm)).toBeGreaterThan(0);
    expect(emitSpy).toHaveBeenCalledWith(
      'internal.delivery-run.optimized',
      expect.objectContaining({ runId: 'r1', provider: 'haversine' }),
    );
  });

  it('provider=google_routes (sin api key) → fallback marcado', async () => {
    runRepo.findOne.mockResolvedValue(makeRun());
    shipmentRepo.find.mockResolvedValue([
      { id: 's1', destinationLat: '0', destinationLng: '3' },
      { id: 's2', destinationLat: '0', destinationLng: '1' },
    ]);
    googleRoutes.optimize.mockResolvedValue({
      provider: 'google_routes',
      totalDistanceKm: 10,
      totalDurationMin: 30,
      sequence: [
        {
          shipmentId: 's2',
          order: 1,
          distanceFromPrevKm: 5,
          durationFromPrevMin: 15,
        },
        {
          shipmentId: 's1',
          order: 2,
          distanceFromPrevKm: 5,
          durationFromPrevMin: 15,
        },
      ],
      fellBackToHaversine: true,
    });

    const r = await service.optimizeRun(
      'r1',
      { provider: 'google_routes' },
      userManager(),
    );
    expect(googleRoutes.optimize).toHaveBeenCalled();
    expect(r.optimizationProvider).toBe('google_routes');
    expect(r.optimizedSequence).toEqual(['s2', 's1']);
  });

  it('SUPER_ADMIN puede optimizar runs de otras empresas', async () => {
    runRepo.findOne.mockResolvedValue(makeRun());
    shipmentRepo.find.mockResolvedValue([
      { id: 's1', destinationLat: '0', destinationLng: '1' },
      { id: 's2', destinationLat: '0', destinationLng: '2' },
    ]);
    const r = await service.optimizeRun('r1', {}, {
      sub: 'admin',
      role: UserRole.SUPER_ADMIN,
      companyId: 'other-co',
    } as any);
    expect(r.optimizedSequence).toHaveLength(2);
  });
});
