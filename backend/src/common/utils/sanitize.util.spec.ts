import { sanitizeString, sanitizePayload } from './sanitize.util';

describe('sanitize.util', () => {
  it('remove tags HTML', () => {
    expect(sanitizeString('<script>alert(1)</script>oi')).toBe('alert(1)oi');
  });

  it('sanitiza objetos aninhados', () => {
    const out = sanitizePayload({ msg: '<b>x</b>', nested: { y: '<i>z</i>' } });
    expect(out).toEqual({ msg: 'x', nested: { y: 'z' } });
  });
});
