import { SavedAddressesController } from './saved-addresses.controller';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({
    sub: 'u1',
    role: UserRole.ADMIN,
    companyId: 'c1',
    email: 'a@test.com',
  }) as IUserPayload;

const makeSvc = () => ({
  create: jest.fn().mockResolvedValue({ id: 'addr1', label: 'Casa' }),
  findAll: jest
    .fn()
    .mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
  findOne: jest.fn().mockResolvedValue({ id: 'addr1', label: 'Casa' }),
  update: jest.fn().mockResolvedValue({ id: 'addr1', label: 'Oficina' }),
  remove: jest.fn().mockResolvedValue(undefined),
});

describe('SavedAddressesController', () => {
  let svc: ReturnType<typeof makeSvc>;
  let ctrl: SavedAddressesController;

  beforeEach(() => {
    svc = makeSvc();
    ctrl = new SavedAddressesController(svc as never);
  });

  it('create — delegates to service.create with dto and user', async () => {
    const dto = {
      label: 'Casa',
      formatted: 'Av. Principal 123',
      lat: -33.45,
      lng: -70.65,
    } as never;
    const result = await ctrl.create(dto, user());
    expect(svc.create).toHaveBeenCalledWith(dto, user());
    expect(result).toEqual({ id: 'addr1', label: 'Casa' });
  });

  it('findAll — delegates to service.findAll with query and user', async () => {
    const query = { page: 1, limit: 20 } as never;
    const result = await ctrl.findAll(query, user());
    expect(svc.findAll).toHaveBeenCalledWith(query, user());
    expect(result).toBeDefined();
  });

  it('findOne — delegates to service.findOne with id and user', async () => {
    const result = await ctrl.findOne('addr1', user());
    expect(svc.findOne).toHaveBeenCalledWith('addr1', user());
    expect(result).toEqual({ id: 'addr1', label: 'Casa' });
  });

  it('update — delegates to service.update with id, dto, and user', async () => {
    const dto = { label: 'Oficina' } as never;
    const result = await ctrl.update('addr1', dto, user());
    expect(svc.update).toHaveBeenCalledWith('addr1', dto, user());
    expect(result).toEqual({ id: 'addr1', label: 'Oficina' });
  });

  it('remove — delegates to service.remove with id and user', async () => {
    const result = await ctrl.remove('addr1', user());
    expect(svc.remove).toHaveBeenCalledWith('addr1', user());
    expect(result).toBeUndefined();
  });
});
