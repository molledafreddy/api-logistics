import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthController } from './health.controller';

// Mock ioredis para que el test sea determinista (no depende de Redis local)
const mockPing = jest.fn();
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    ping: mockPing,
    disconnect: mockDisconnect,
  })),
);

describe('HealthController', () => {
  let controller: HealthController;
  let dbQuery: jest.Mock;

  beforeEach(async () => {
    dbQuery = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    mockPing.mockReset().mockResolvedValue('PONG');
    mockConnect.mockReset().mockResolvedValue(undefined);
    mockDisconnect.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: getDataSourceToken(),
          useValue: { query: dbQuery },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, def?: unknown) => def),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return health status', () => {
      const result = controller.check();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('env');
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('live', () => {
    it('should return liveness payload', () => {
      const result = controller.live();
      expect(result).toHaveProperty('status', 'alive');
      expect(result).toHaveProperty('pid');
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('ready', () => {
    it('returns 200 when DB and Redis are up', async () => {
      const result = await controller.ready();
      expect(result).toMatchObject({
        status: 'ready',
        checks: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
      });
      expect(dbQuery).toHaveBeenCalledWith('SELECT 1');
      expect(mockPing).toHaveBeenCalled();
    });

    it('throws ServiceUnavailable when DB is down', async () => {
      dbQuery.mockRejectedValueOnce(new Error('connection refused'));
      await expect(controller.ready()).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 'not_ready',
          checks: expect.objectContaining({
            database: expect.objectContaining({
              status: 'down',
              error: 'connection refused',
            }),
          }),
        }),
      });
    });

    it('throws ServiceUnavailable when Redis is down', async () => {
      mockConnect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(controller.ready()).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 'not_ready',
          checks: expect.objectContaining({
            redis: expect.objectContaining({
              status: 'down',
              error: 'ECONNREFUSED',
            }),
          }),
        }),
      });
    });
  });
});
