import { AuthController } from './auth.controller';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  register: jest.fn().mockResolvedValue('R'),
  login: jest.fn().mockResolvedValue('L'),
  refreshToken: jest.fn().mockResolvedValue('RT'),
  logout: jest.fn().mockResolvedValue('LO'),
  getProfile: jest.fn().mockResolvedValue('P'),
  resendVerificationCode: jest.fn().mockResolvedValue('RV'),
  verifyEmailCode: jest.fn().mockResolvedValue('SV'),
});

describe('AuthController', () => {
  let s: ReturnType<typeof svc>;
  let c: AuthController;
  beforeEach(() => {
    s = svc();
    c = new AuthController(s as never);
  });

  it('register passes ipAddress from req.ip', async () => {
    await c.register({ email: 'a' } as never, { ip: '1.2.3.4' } as never);
    expect(s.register).toHaveBeenCalledWith({ email: 'a' }, '1.2.3.4');
  });
  it('register falls back to socket.remoteAddress', async () => {
    await c.register(
      {} as never,
      { socket: { remoteAddress: '5.6.7.8' } } as never,
    );
    expect(s.register).toHaveBeenCalledWith({}, '5.6.7.8');
  });
  it('login passes ipAddress', async () => {
    await c.login({ email: 'a' } as never, { ip: '9.9.9.9' } as never);
    expect(s.login).toHaveBeenCalledWith({ email: 'a' }, '9.9.9.9');
  });
  it('refreshToken extracts dto.refreshToken', async () => {
    await c.refreshToken({ refreshToken: 'tok' } as never);
    expect(s.refreshToken).toHaveBeenCalledWith('tok');
  });
  it('logout strips Bearer prefix', async () => {
    await c.logout('Bearer abc');
    expect(s.logout).toHaveBeenCalledWith('abc');
  });
  it('logout handles missing header', async () => {
    await c.logout(undefined as never);
    expect(s.logout).toHaveBeenCalledWith('');
  });
  it('getProfile uses user.sub', async () => {
    await c.getProfile(user());
    expect(s.getProfile).toHaveBeenCalledWith('u1');
  });
  it('resendVerification passes dto.email', async () => {
    await c.resendVerification({ email: 'a@b.com' } as never);
    expect(s.resendVerificationCode).toHaveBeenCalledWith('a@b.com');
  });
  it('verifyEmail passes dto.email and dto.code', async () => {
    await c.verifyEmail({ email: 'a@b.com', code: '123456' } as never);
    expect(s.verifyEmailCode).toHaveBeenCalledWith('a@b.com', '123456');
  });
});
