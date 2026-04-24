import { ShipmentsController } from './shipments.controller';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  create: jest.fn().mockResolvedValue('CREATED'),
  findAll: jest.fn().mockResolvedValue('LIST'),
  findByTrackingCode: jest.fn().mockResolvedValue('TRACK'),
  findOne: jest.fn().mockResolvedValue('ONE'),
  getTimeline: jest.fn().mockResolvedValue('TIMELINE'),
  update: jest.fn().mockResolvedValue('UPDATED'),
  updateStatus: jest.fn().mockResolvedValue('STATUS'),
  assign: jest.fn().mockResolvedValue('ASSIGN'),
  cancel: jest.fn().mockResolvedValue('CANCEL'),
  accept: jest.fn().mockResolvedValue('ACCEPT'),
  reject: jest.fn().mockResolvedValue('REJECT'),
  uploadPod: jest.fn().mockResolvedValue('POD'),
  complete: jest.fn().mockResolvedValue('COMPLETE'),
  remove: jest.fn().mockResolvedValue(undefined),
});

describe('ShipmentsController', () => {
  let s: ReturnType<typeof svc>;
  let c: ShipmentsController;

  beforeEach(() => {
    s = svc();
    c = new ShipmentsController(s as never);
  });

  it('create delegates', async () => {
    await expect(c.create({ x: 1 } as never, user())).resolves.toBe('CREATED');
    expect(s.create).toHaveBeenCalledWith({ x: 1 }, user());
  });
  it('findAll delegates', async () => {
    await expect(c.findAll({} as never, user())).resolves.toBe('LIST');
  });
  it('findByTrackingCode delegates', async () => {
    await expect(c.findByTrackingCode('AAA')).resolves.toBe('TRACK');
    expect(s.findByTrackingCode).toHaveBeenCalledWith('AAA');
  });
  it('findOne', async () => {
    await expect(c.findOne('id', user())).resolves.toBe('ONE');
  });
  it('getTimeline', async () => {
    await expect(c.getTimeline('id', user())).resolves.toBe('TIMELINE');
  });
  it('update', async () => {
    await expect(c.update('id', { foo: 1 } as never, user())).resolves.toBe(
      'UPDATED',
    );
  });
  it('updateStatus extracts dto.status', async () => {
    await c.updateStatus(
      'id',
      { status: ShipmentStatus.DELIVERED } as never,
      user(),
    );
    expect(s.updateStatus).toHaveBeenCalledWith(
      'id',
      ShipmentStatus.DELIVERED,
      user(),
    );
  });
  it('assign', async () => {
    await expect(
      c.assign('id', { truckId: 't' } as never, user()),
    ).resolves.toBe('ASSIGN');
  });
  it('cancel extracts dto.reason', async () => {
    await c.cancel('id', { reason: 'no' } as never, user());
    expect(s.cancel).toHaveBeenCalledWith('id', 'no', user());
  });
  it('accept', async () => {
    await expect(
      c.accept('id', { notes: 'ok' } as never, user()),
    ).resolves.toBe('ACCEPT');
  });
  it('reject', async () => {
    await expect(
      c.reject('id', { reason: 'no' } as never, user()),
    ).resolves.toBe('REJECT');
  });
  it('uploadPod', async () => {
    await expect(
      c.uploadPod('id', { podUrl: 'u' } as never, user()),
    ).resolves.toBe('POD');
  });
  it('complete', async () => {
    await expect(c.complete('id', user())).resolves.toBe('COMPLETE');
  });
  it('remove', async () => {
    await c.remove('id', user());
    expect(s.remove).toHaveBeenCalledWith('id', user());
  });
});
