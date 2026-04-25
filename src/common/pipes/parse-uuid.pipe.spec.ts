import { BadRequestException } from '@nestjs/common';

jest.mock('uuid', () => ({
  validate: (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ParseUuidPipe } = require('./parse-uuid.pipe');

describe('ParseUuidPipe', () => {
  const pipe = new ParseUuidPipe();
  it('returns valid uuid unchanged', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(pipe.transform(id)).toBe(id);
  });
  it('throws on invalid uuid', () => {
    expect(() => pipe.transform('not-a-uuid')).toThrow(BadRequestException);
  });
});
