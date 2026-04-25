import { CompaniesController } from './companies.controller';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.SUPER_ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  create: jest.fn().mockResolvedValue('OK'),
  findAll: jest.fn().mockResolvedValue('OK'),
  findOne: jest.fn().mockResolvedValue('OK'),
  update: jest.fn().mockResolvedValue('OK'),
  remove: jest.fn().mockResolvedValue(undefined),
});

describe('CompaniesController', () => {
  let s: ReturnType<typeof svc>;
  let c: CompaniesController;
  beforeEach(() => {
    s = svc();
    c = new CompaniesController(s as never);
  });

  it('create', async () => {
    await c.create({ name: 'X' } as never);
    expect(s.create).toHaveBeenCalledWith({ name: 'X' });
  });
  it('findAll', async () => {
    await c.findAll({} as never, user());
    expect(s.findAll).toHaveBeenCalledWith({}, user());
  });
  it('findOne', async () => {
    await c.findOne('id', user());
    expect(s.findOne).toHaveBeenCalledWith('id', user());
  });
  it('update', async () => {
    await c.update('id', {} as never, user());
    expect(s.update).toHaveBeenCalled();
  });
  it('remove', async () => {
    await c.remove('id', user());
    expect(s.remove).toHaveBeenCalledWith('id', user());
  });
});
