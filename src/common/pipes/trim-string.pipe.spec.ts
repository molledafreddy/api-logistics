import { TrimStringPipe } from './trim-string.pipe';

describe('TrimStringPipe', () => {
  const pipe = new TrimStringPipe();

  it('trims string fields in body', () => {
    const out = pipe.transform({ name: '  John  ', age: 30 }, {
      type: 'body',
    } as never);
    expect(out).toEqual({ name: 'John', age: 30 });
  });
  it('recurses into nested objects', () => {
    const out = pipe.transform({ user: { name: '  X  ' }, n: 1 }, {
      type: 'body',
    } as never);
    expect(out).toEqual({ user: { name: 'X' }, n: 1 });
  });
  it('returns value unchanged when not body', () => {
    const v = { name: '  X  ' };
    expect(pipe.transform(v, { type: 'query' } as never)).toBe(v);
  });
  it('returns primitives unchanged', () => {
    expect(pipe.transform('hello', { type: 'body' } as never)).toBe('hello');
    expect(pipe.transform(42, { type: 'body' } as never)).toBe(42);
  });
});
