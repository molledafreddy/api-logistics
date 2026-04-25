import { generateSlug } from './slug.util';

describe('generateSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });
  it('removes accents', () => {
    expect(generateSlug('Camión Niño')).toBe('camion-nino');
  });
  it('removes non-alphanumeric chars', () => {
    expect(generateSlug('Hello! @World#')).toBe('hello-world');
  });
  it('dedupes hyphens', () => {
    expect(generateSlug('a   b   c')).toBe('a-b-c');
  });
  it('trims leading/trailing hyphens', () => {
    expect(generateSlug('  -hello-  ')).toBe('hello');
  });
});
