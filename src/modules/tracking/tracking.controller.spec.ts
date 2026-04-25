import { TrackingController } from './tracking.controller';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.DRIVER, companyId: 'c1' }) as never;

const svc = () => ({
  create: jest.fn().mockResolvedValue('OK'),
  createBulk: jest.fn().mockResolvedValue('OK'),
  query: jest.fn().mockResolvedValue('OK'),
  getLatestForShipment: jest.fn().mockResolvedValue('OK'),
  getLatestForTruck: jest.fn().mockResolvedValue('OK'),
  getStats: jest.fn().mockResolvedValue('OK'),
});

describe('TrackingController', () => {
  let s: ReturnType<typeof svc>;
  let c: TrackingController;
  beforeEach(() => {
    s = svc();
    c = new TrackingController(s as never);
  });

  it('create', async () => {
    await c.create({} as never, user());
    expect(s.create).toHaveBeenCalled();
  });
  it('bulk delegates to createBulk', async () => {
    await c.bulk({} as never, user());
    expect(s.createBulk).toHaveBeenCalled();
  });
  it('query', async () => {
    await c.query({} as never, user());
    expect(s.query).toHaveBeenCalled();
  });
  it('latestShipment', async () => {
    await c.latestShipment('sid', user());
    expect(s.getLatestForShipment).toHaveBeenCalledWith('sid', user());
  });
  it('latestTruck', async () => {
    await c.latestTruck('tid', user());
    expect(s.getLatestForTruck).toHaveBeenCalledWith('tid', user());
  });
  it('stats', async () => {
    await c.stats({} as never, user());
    expect(s.getStats).toHaveBeenCalled();
  });
});
