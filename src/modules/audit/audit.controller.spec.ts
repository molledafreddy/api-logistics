import { AuditController } from './audit.controller';

const svc = () => ({
  findByCompany: jest.fn().mockResolvedValue('OK'),
  findByResource: jest.fn().mockResolvedValue('OK'),
});

describe('AuditController', () => {
  let s: ReturnType<typeof svc>;
  let c: AuditController;
  beforeEach(() => {
    s = svc();
    c = new AuditController(s as never);
  });

  it('findByCompany defaults', async () => {
    await c.findByCompany('cid');
    expect(s.findByCompany).toHaveBeenCalledWith('cid', 1, 50);
  });
  it('findByCompany coerces', async () => {
    await c.findByCompany('cid', '2', '100');
    expect(s.findByCompany).toHaveBeenCalledWith('cid', 2, 100);
  });
  it('findByCompany NaN -> defaults', async () => {
    await c.findByCompany('cid', 'x', 'y');
    expect(s.findByCompany).toHaveBeenCalledWith('cid', 1, 50);
  });
  it('findByResource', async () => {
    await c.findByResource('company', 'rid');
    expect(s.findByResource).toHaveBeenCalledWith('company', 'rid');
  });
});
