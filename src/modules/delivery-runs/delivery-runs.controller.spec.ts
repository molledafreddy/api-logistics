import { DeliveryRunsController } from './delivery-runs.controller';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  create: jest.fn().mockResolvedValue('OK'),
  findAll: jest.fn().mockResolvedValue('OK'),
  findOne: jest.fn().mockResolvedValue('OK'),
  update: jest.fn().mockResolvedValue('OK'),
  assignDriver: jest.fn().mockResolvedValue('OK'),
  addShipments: jest.fn().mockResolvedValue('OK'),
  removeShipments: jest.fn().mockResolvedValue('OK'),
  reorder: jest.fn().mockResolvedValue('OK'),
  start: jest.fn().mockResolvedValue('OK'),
  complete: jest.fn().mockResolvedValue('OK'),
  cancel: jest.fn().mockResolvedValue('OK'),
  stopDone: jest.fn().mockResolvedValue('OK'),
  stopIncident: jest.fn().mockResolvedValue('OK'),
});

describe('DeliveryRunsController', () => {
  let s: ReturnType<typeof svc>;
  let c: DeliveryRunsController;
  beforeEach(() => {
    s = svc();
    c = new DeliveryRunsController(s as never);
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
  it('assignDriver', async () => {
    await c.assignDriver('id', {} as never, user());
    expect(s.assignDriver).toHaveBeenCalled();
  });
  it('addShipments', async () => {
    await c.addShipments('id', {} as never, user());
    expect(s.addShipments).toHaveBeenCalled();
  });
  it('removeShipments', async () => {
    await c.removeShipments('id', {} as never, user());
    expect(s.removeShipments).toHaveBeenCalled();
  });
  it('reorder', async () => {
    await c.reorder('id', {} as never, user());
    expect(s.reorder).toHaveBeenCalled();
  });
  it('start', async () => {
    await c.start('id', user());
    expect(s.start).toHaveBeenCalledWith('id', user());
  });
  it('complete', async () => {
    await c.complete('id', user());
    expect(s.complete).toHaveBeenCalledWith('id', user());
  });
  it('cancel', async () => {
    await c.cancel('id', { reason: 'no' } as never, user());
    expect(s.cancel).toHaveBeenCalled();
  });
  it('stopDone', async () => {
    await c.stopDone('id', 'sid', {} as never, user());
    expect(s.stopDone).toHaveBeenCalledWith('id', 'sid', {}, user());
  });
  it('stopIncident', async () => {
    await c.stopIncident('id', 'sid', {} as never, user());
    expect(s.stopIncident).toHaveBeenCalledWith('id', 'sid', {}, user());
  });
});
