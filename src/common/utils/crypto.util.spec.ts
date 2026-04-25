import { generateToken, hashToken } from './crypto.util';

describe('crypto.util', () => {
  it('generateToken default length 32 → 64 hex chars', () => {
    const t = generateToken();
    expect(t).toHaveLength(64);
    expect(t).toMatch(/^[a-f0-9]+$/);
  });
  it('generateToken accepts custom length', () => {
    const t = generateToken(16);
    expect(t).toHaveLength(32);
  });
  it('two tokens are different', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
  it('hashToken is deterministic and 64-char sha256', () => {
    const h1 = hashToken('hello');
    const h2 = hashToken('hello');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(hashToken('world')).not.toBe(h1);
  });
});
