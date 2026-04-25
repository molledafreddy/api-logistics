import { NotificationsController } from './notifications.controller';

const svc = () => ({
  findByUser: jest.fn().mockResolvedValue('LIST'),
  markAsRead: jest.fn().mockResolvedValue('OK'),
  markAllRead: jest.fn().mockResolvedValue('OK'),
  registerPushToken: jest.fn().mockResolvedValue('OK'),
  removePushToken: jest.fn().mockResolvedValue('OK'),
});

const user = { sub: 'u1' };

describe('NotificationsController', () => {
  let s: ReturnType<typeof svc>;
  let c: NotificationsController;
  beforeEach(() => {
    s = svc();
    c = new NotificationsController(s as never);
  });

  it('findMine uses defaults when no page/limit', async () => {
    await c.findMine(user);
    expect(s.findByUser).toHaveBeenCalledWith('u1', 1, 20);
  });
  it('findMine coerces page/limit strings', async () => {
    await c.findMine(user, '2', '50');
    expect(s.findByUser).toHaveBeenCalledWith('u1', 2, 50);
  });
  it('findMine falls back to defaults on NaN', async () => {
    await c.findMine(user, 'abc', 'xyz');
    expect(s.findByUser).toHaveBeenCalledWith('u1', 1, 20);
  });
  it('markAsRead', async () => {
    await c.markAsRead('nid');
    expect(s.markAsRead).toHaveBeenCalledWith('nid');
  });
  it('markAllRead uses user.sub', async () => {
    await c.markAllRead(user);
    expect(s.markAllRead).toHaveBeenCalledWith('u1');
  });
  it('registerPushToken extracts body fields', async () => {
    await c.registerPushToken(user, {
      token: 't',
      platform: 'ios',
      deviceName: 'iPhone',
    });
    expect(s.registerPushToken).toHaveBeenCalledWith(
      'u1',
      't',
      'ios',
      'iPhone',
    );
  });
  it('removePushToken', async () => {
    await c.removePushToken(user, 'tok');
    expect(s.removePushToken).toHaveBeenCalledWith('u1', 'tok');
  });
});
