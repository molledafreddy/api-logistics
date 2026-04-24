import { ExpensesController } from './expenses.controller';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  create: jest.fn().mockResolvedValue('OK'),
  findAll: jest.fn().mockResolvedValue('OK'),
  getSummary: jest.fn().mockResolvedValue('OK'),
  findOne: jest.fn().mockResolvedValue('OK'),
  update: jest.fn().mockResolvedValue('OK'),
  approve: jest.fn().mockResolvedValue('OK'),
  reject: jest.fn().mockResolvedValue('OK'),
  reimburse: jest.fn().mockResolvedValue('OK'),
  remove: jest.fn().mockResolvedValue(undefined),
});

describe('ExpensesController', () => {
  let s: ReturnType<typeof svc>;
  let c: ExpensesController;
  beforeEach(() => {
    s = svc();
    c = new ExpensesController(s as never);
  });

  it('create', async () => {
    await c.create({ amount: 10 } as never, user());
    expect(s.create).toHaveBeenCalled();
  });
  it('findAll', async () => {
    await c.findAll({} as never, user());
    expect(s.findAll).toHaveBeenCalled();
  });
  it('summary', async () => {
    await c.summary({} as never, user());
    expect(s.getSummary).toHaveBeenCalled();
  });
  it('findOne', async () => {
    await c.findOne('id', user());
    expect(s.findOne).toHaveBeenCalledWith('id', user());
  });
  it('update', async () => {
    await c.update('id', {} as never, user());
    expect(s.update).toHaveBeenCalled();
  });
  it('approve', async () => {
    await c.approve('id', user());
    expect(s.approve).toHaveBeenCalledWith('id', user());
  });
  it('reject extracts dto.reason', async () => {
    await c.reject('id', { reason: 'no' } as never, user());
    expect(s.reject).toHaveBeenCalledWith('id', 'no', user());
  });
  it('reimburse', async () => {
    await c.reimburse('id', user());
    expect(s.reimburse).toHaveBeenCalledWith('id', user());
  });
  it('remove', async () => {
    await c.remove('id', user());
    expect(s.remove).toHaveBeenCalledWith('id', user());
  });
});
