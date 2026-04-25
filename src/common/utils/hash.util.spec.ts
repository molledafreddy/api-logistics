import { hashPassword, comparePassword } from './hash.util';

describe('hash.util', () => {
  it('hashes a password (bcrypt)', async () => {
    const h = await hashPassword('Secret123!');
    expect(h).toMatch(/^\$2[aby]\$/);
    expect(h).not.toBe('Secret123!');
  });
  it('comparePassword returns true for correct password', async () => {
    const h = await hashPassword('Secret123!');
    await expect(comparePassword('Secret123!', h)).resolves.toBe(true);
  });
  it('comparePassword returns false for wrong password', async () => {
    const h = await hashPassword('Secret123!');
    await expect(comparePassword('Wrong', h)).resolves.toBe(false);
  });
});
