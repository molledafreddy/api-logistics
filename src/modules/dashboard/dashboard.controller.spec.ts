import { DashboardController } from './dashboard.controller';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  overview: jest.fn().mockResolvedValue('OK'),
  shipmentsByStatus: jest.fn().mockResolvedValue('OK'),
  revenue: jest.fn().mockResolvedValue('OK'),
  expensesByCategory: jest.fn().mockResolvedValue('OK'),
  fleetUtilization: jest.fn().mockResolvedValue('OK'),
  topDrivers: jest.fn().mockResolvedValue('OK'),
});

describe('DashboardController', () => {
  let s: ReturnType<typeof svc>;
  let c: DashboardController;
  beforeEach(() => {
    s = svc();
    c = new DashboardController(s as never);
  });

  const q = {} as never;
  it('overview', async () => {
    await c.overview(q, user());
    expect(s.overview).toHaveBeenCalledWith({}, user());
  });
  it('shipmentsByStatus', async () => {
    await c.shipmentsByStatus(q, user());
    expect(s.shipmentsByStatus).toHaveBeenCalled();
  });
  it('revenue', async () => {
    await c.revenue(q, user());
    expect(s.revenue).toHaveBeenCalled();
  });
  it('expensesByCategory', async () => {
    await c.expensesByCategory(q, user());
    expect(s.expensesByCategory).toHaveBeenCalled();
  });
  it('fleetUtilization', async () => {
    await c.fleetUtilization(q, user());
    expect(s.fleetUtilization).toHaveBeenCalled();
  });
  it('topDrivers', async () => {
    await c.topDrivers(q, user());
    expect(s.topDrivers).toHaveBeenCalled();
  });
});
