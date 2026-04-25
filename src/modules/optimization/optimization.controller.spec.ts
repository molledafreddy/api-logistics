import { OptimizationController } from './optimization.controller';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.DISPATCHER, companyId: 'c1' }) as never;

const optSvc = () => ({
  optimizeRun: jest.fn().mockResolvedValue('OPT'),
});
const etaSvc = () => ({
  computeLive: jest.fn().mockResolvedValue('ETAS'),
});

describe('OptimizationController', () => {
  let opt: ReturnType<typeof optSvc>;
  let eta: ReturnType<typeof etaSvc>;
  let c: OptimizationController;
  beforeEach(() => {
    opt = optSvc();
    eta = etaSvc();
    c = new OptimizationController(opt as never, eta as never);
  });

  it('optimize delegates to optimization.optimizeRun', async () => {
    const dto = { provider: 'haversine' } as never;
    await c.optimize('rid', dto, user());
    expect(opt.optimizeRun).toHaveBeenCalledWith('rid', dto, user());
  });
  it('etas delegates to eta.computeLive', async () => {
    await c.etas('rid', user());
    expect(eta.computeLive).toHaveBeenCalledWith('rid', user());
  });
});
