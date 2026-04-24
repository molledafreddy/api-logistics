import { DriversController } from './drivers.controller';
import { DriverStatus } from '../../common/enums/driver-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  create: jest.fn().mockResolvedValue('OK'),
  findAll: jest.fn().mockResolvedValue('OK'),
  findOne: jest.fn().mockResolvedValue('OK'),
  getCurrentTrip: jest.fn().mockResolvedValue('OK'),
  getStats: jest.fn().mockResolvedValue('OK'),
  update: jest.fn().mockResolvedValue('OK'),
  updateStatus: jest.fn().mockResolvedValue('OK'),
  remove: jest.fn().mockResolvedValue(undefined),
});

describe('DriversController', () => {
  let s: ReturnType<typeof svc>;
  let c: DriversController;
  beforeEach(() => {
    s = svc();
    c = new DriversController(s as never);
  });

  it('create', async () => {
    await c.create({ licenseNumber: 'L1' } as never, user());
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
  it('getCurrentTrip', async () => {
    await c.getCurrentTrip('id', user());
    expect(s.getCurrentTrip).toHaveBeenCalledWith('id', user());
  });
  it('getStats', async () => {
    await c.getStats('id', user());
    expect(s.getStats).toHaveBeenCalledWith('id', user());
  });
  it('update', async () => {
    await c.update('id', {} as never, user());
    expect(s.update).toHaveBeenCalled();
  });
  it('updateStatus extracts dto.status', async () => {
    await c.updateStatus(
      'id',
      { status: DriverStatus.ON_TRIP } as never,
      user(),
    );
    expect(s.updateStatus).toHaveBeenCalledWith(
      'id',
      DriverStatus.ON_TRIP,
      user(),
    );
  });
  it('remove', async () => {
    await c.remove('id', user());
    expect(s.remove).toHaveBeenCalledWith('id', user());
  });
});
