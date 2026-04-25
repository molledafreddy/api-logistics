import { UsersController } from './users.controller';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  findAll: jest.fn().mockResolvedValue('OK'),
  invite: jest.fn().mockResolvedValue('OK'),
  acceptInvite: jest.fn().mockResolvedValue('OK'),
  findOne: jest.fn().mockResolvedValue('OK'),
  update: jest.fn().mockResolvedValue('OK'),
  updateRole: jest.fn().mockResolvedValue('OK'),
  deactivate: jest.fn().mockResolvedValue('OK'),
  reactivate: jest.fn().mockResolvedValue('OK'),
});

describe('UsersController', () => {
  let s: ReturnType<typeof svc>;
  let c: UsersController;
  beforeEach(() => {
    s = svc();
    c = new UsersController(s as never);
  });

  it('findAll', async () => {
    await c.findAll({} as never, user());
    expect(s.findAll).toHaveBeenCalledWith({}, user());
  });
  it('invite', async () => {
    await c.invite({ email: 'x' } as never, user());
    expect(s.invite).toHaveBeenCalled();
  });
  it('acceptInvite', async () => {
    await c.acceptInvite({ token: 't' } as never);
    expect(s.acceptInvite).toHaveBeenCalledWith({ token: 't' });
  });
  it('findOne', async () => {
    await c.findOne('id', user());
    expect(s.findOne).toHaveBeenCalledWith('id', user());
  });
  it('update', async () => {
    await c.update('id', {} as never, user());
    expect(s.update).toHaveBeenCalled();
  });
  it('updateRole', async () => {
    await c.updateRole('id', { role: UserRole.MANAGER } as never, user());
    expect(s.updateRole).toHaveBeenCalled();
  });
  it('deactivate', async () => {
    await c.deactivate('id', user());
    expect(s.deactivate).toHaveBeenCalledWith('id', user());
  });
  it('reactivate', async () => {
    await c.reactivate('id', user());
    expect(s.reactivate).toHaveBeenCalledWith('id', user());
  });
});
