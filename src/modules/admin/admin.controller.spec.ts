import { AdminController } from './admin.controller';

const mkRepo = () => ({
  count: jest.fn().mockResolvedValue(0),
  find: jest.fn().mockResolvedValue([]),
  findOneByOrFail: jest.fn().mockResolvedValue({ id: 'x' }),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('AdminController', () => {
  let companyRepo: ReturnType<typeof mkRepo>;
  let subRepo: ReturnType<typeof mkRepo>;
  let verRepo: ReturnType<typeof mkRepo>;
  let c: AdminController;

  beforeEach(() => {
    companyRepo = mkRepo();
    subRepo = mkRepo();
    verRepo = mkRepo();
    companyRepo.count.mockResolvedValue(3);
    subRepo.count.mockResolvedValue(2);
    verRepo.count.mockResolvedValue(1);
    c = new AdminController(
      companyRepo as never,
      subRepo as never,
      verRepo as never,
    );
  });

  it('dashboard aggregates counts', async () => {
    const out = await c.dashboard();
    expect(out).toEqual({ companies: 3, subscriptions: 2, verifications: 1 });
  });
  it('listCompanies uses defaults', async () => {
    await c.listCompanies();
    expect(companyRepo.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      skip: 0,
      take: 20,
    });
  });
  it('listCompanies coerces page/limit', async () => {
    await c.listCompanies('3', '10');
    expect(companyRepo.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      skip: 20,
      take: 10,
    });
  });
  it('getCompany', async () => {
    await c.getCompany('cid');
    expect(companyRepo.findOneByOrFail).toHaveBeenCalledWith({ id: 'cid' });
  });
  it('updateCompany', async () => {
    await c.updateCompany('cid', { name: 'N' });
    expect(companyRepo.update).toHaveBeenCalledWith('cid', { name: 'N' });
    expect(companyRepo.findOneByOrFail).toHaveBeenCalledWith({ id: 'cid' });
  });
  it('listSubscriptions', async () => {
    await c.listSubscriptions('2', '5');
    expect(subRepo.find).toHaveBeenCalledWith({
      order: { created_at: 'DESC' },
      skip: 5,
      take: 5,
    });
  });
  it('listVerifications without status', async () => {
    await c.listVerifications();
    expect(verRepo.find).toHaveBeenCalledWith({
      where: {},
      order: { createdAt: 'DESC' },
      skip: 0,
      take: 20,
    });
  });
  it('listVerifications with status filter', async () => {
    await c.listVerifications('pending', '1', '10');
    expect(verRepo.find).toHaveBeenCalledWith({
      where: { status: 'pending' },
      order: { createdAt: 'DESC' },
      skip: 0,
      take: 10,
    });
  });
});
