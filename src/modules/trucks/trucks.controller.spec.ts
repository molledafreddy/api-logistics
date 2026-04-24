import { TrucksController } from './trucks.controller';
import { TruckStatus } from '../../common/enums/truck-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  create: jest.fn().mockResolvedValue('OK'),
  findAll: jest.fn().mockResolvedValue('OK'),
  findOne: jest.fn().mockResolvedValue('OK'),
  getLocation: jest.fn().mockResolvedValue('OK'),
  update: jest.fn().mockResolvedValue('OK'),
  updateStatus: jest.fn().mockResolvedValue('OK'),
  assignDriver: jest.fn().mockResolvedValue('OK'),
  unassignDriver: jest.fn().mockResolvedValue('OK'),
  remove: jest.fn().mockResolvedValue(undefined),
});

describe('TrucksController', () => {
  let s: ReturnType<typeof svc>;
  let c: TrucksController;
  beforeEach(() => {
    s = svc();
    c = new TrucksController(s as never);
  });

  it('create', async () => {
    await c.create({ plate: 'X' } as never, user());
    expect(s.create).toHaveBeenCalledWith({ plate: 'X' }, user());
  });
  it('findAll', async () => {
    await c.findAll({} as never, user());
    expect(s.findAll).toHaveBeenCalled();
  });
  it('findOne', async () => {
    await c.findOne('id', user());
    expect(s.findOne).toHaveBeenCalledWith('id', user());
  });
  it('getLocation', async () => {
    await c.getLocation('id', user());
    expect(s.getLocation).toHaveBeenCalledWith('id', user());
  });
  it('update', async () => {
    await c.update('id', { plate: 'Y' } as never, user());
    expect(s.update).toHaveBeenCalled();
  });
  it('updateStatus extracts dto.status', async () => {
    await c.updateStatus(
      'id',
      { status: TruckStatus.MAINTENANCE } as never,
      user(),
    );
    expect(s.updateStatus).toHaveBeenCalledWith(
      'id',
      TruckStatus.MAINTENANCE,
      user(),
    );
  });
  it('assignDriver extracts dto.driverId', async () => {
    await c.assignDriver('id', { driverId: 'd1' } as never, user());
    expect(s.assignDriver).toHaveBeenCalledWith('id', 'd1', user());
  });
  it('unassignDriver', async () => {
    await c.unassignDriver('id', user());
    expect(s.unassignDriver).toHaveBeenCalledWith('id', user());
  });
  it('remove', async () => {
    await c.remove('id', user());
    expect(s.remove).toHaveBeenCalledWith('id', user());
  });
});
