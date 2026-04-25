import { RoutesController } from './routes.controller';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  create: jest.fn().mockResolvedValue('OK'),
  findAll: jest.fn().mockResolvedValue('OK'),
  findOne: jest.fn().mockResolvedValue('OK'),
  update: jest.fn().mockResolvedValue('OK'),
  duplicate: jest.fn().mockResolvedValue('OK'),
  setStatus: jest.fn().mockResolvedValue('OK'),
  remove: jest.fn().mockResolvedValue(undefined),
});

describe('RoutesController', () => {
  let s: ReturnType<typeof svc>;
  let c: RoutesController;
  beforeEach(() => {
    s = svc();
    c = new RoutesController(s as never);
  });

  it('create', async () => {
    await c.create({} as never, user());
    expect(s.create).toHaveBeenCalled();
  });
  it('findAll', async () => {
    await c.findAll({} as never, user());
    expect(s.findAll).toHaveBeenCalled();
  });
  it('findOne', async () => {
    await c.findOne('id', user());
    expect(s.findOne).toHaveBeenCalledWith('id', user());
  });
  it('update', async () => {
    await c.update('id', {} as never, user());
    expect(s.update).toHaveBeenCalled();
  });
  it('duplicate', async () => {
    await c.duplicate('id', user());
    expect(s.duplicate).toHaveBeenCalledWith('id', user());
  });
  it('activate calls setStatus with active', async () => {
    await c.activate('id', user());
    expect(s.setStatus).toHaveBeenCalledWith('id', 'active', user());
  });
  it('archive calls setStatus with archived', async () => {
    await c.archive('id', user());
    expect(s.setStatus).toHaveBeenCalledWith('id', 'archived', user());
  });
  it('remove', async () => {
    await c.remove('id', user());
    expect(s.remove).toHaveBeenCalledWith('id', user());
  });
});
