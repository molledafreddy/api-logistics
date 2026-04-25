import { ReportsController } from './reports.controller';
import { ReportFormat } from './dto';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  shipments: jest.fn().mockResolvedValue([{ a: 1 }]),
  expenses: jest.fn().mockResolvedValue([{ a: 1 }]),
  driversPerformance: jest.fn().mockResolvedValue([{ a: 1 }]),
  financialSummary: jest.fn().mockResolvedValue({ revenue: 0 }),
  toCsv: jest.fn().mockReturnValue('csv-string'),
});

const mkRes = () => ({
  setHeader: jest.fn(),
  send: jest.fn(),
});

describe('ReportsController', () => {
  let s: ReturnType<typeof svc>;
  let c: ReportsController;
  beforeEach(() => {
    s = svc();
    c = new ReportsController(s as never);
  });

  it('shipments JSON returns data', async () => {
    const res = mkRes();
    const out = await c.shipments({} as never, user(), res as never);
    expect(s.shipments).toHaveBeenCalled();
    expect(out).toEqual([{ a: 1 }]);
    expect(res.send).not.toHaveBeenCalled();
  });
  it('shipments CSV writes headers and sends csv', async () => {
    const res = mkRes();
    await c.shipments(
      { format: ReportFormat.CSV } as never,
      user(),
      res as never,
    );
    expect(s.toCsv).toHaveBeenCalledWith([{ a: 1 }]);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(res.send).toHaveBeenCalledWith('csv-string');
  });
  it('expenses JSON', async () => {
    const res = mkRes();
    const out = await c.expenses({} as never, user(), res as never);
    expect(out).toEqual([{ a: 1 }]);
  });
  it('expenses CSV', async () => {
    const res = mkRes();
    await c.expenses(
      { format: ReportFormat.CSV } as never,
      user(),
      res as never,
    );
    expect(res.send).toHaveBeenCalledWith('csv-string');
  });
  it('driversPerformance JSON', async () => {
    const res = mkRes();
    await c.driversPerformance({} as never, user(), res as never);
    expect(s.driversPerformance).toHaveBeenCalled();
  });
  it('driversPerformance CSV', async () => {
    const res = mkRes();
    await c.driversPerformance(
      { format: ReportFormat.CSV } as never,
      user(),
      res as never,
    );
    expect(res.send).toHaveBeenCalled();
  });
  it('financialSummary', async () => {
    const out = await c.financialSummary({} as never, user());
    expect(s.financialSummary).toHaveBeenCalled();
    expect(out).toEqual({ revenue: 0 });
  });
});
