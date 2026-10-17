import { layoutFor } from './breakpoints';

describe('layoutFor', () => {
  it('is phone under 640 px', () => {
    expect(layoutFor(390)).toBe('phone');
    expect(layoutFor(639)).toBe('phone');
  });
  it('is tablet from 640 to 1100 px', () => {
    expect(layoutFor(640)).toBe('tablet');
    expect(layoutFor(1100)).toBe('tablet');
  });
  it('is desktop above 1100 px', () => {
    expect(layoutFor(1101)).toBe('desktop');
  });
});
