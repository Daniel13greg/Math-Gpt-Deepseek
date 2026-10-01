import { frameToCrop } from '@/lib/cropFrame';

describe('frameToCrop', () => {
  it('maps the frame through a cover-scaled preview', () => {
    // 3000x4000 photo shown in a 300x500 view: scale = max(0.1, 0.125) = 0.125 → 375px wide, 37.5px hidden per side.
    const crop = frameToCrop({ x: 50, y: 100, w: 200, h: 100 }, { width: 300, height: 500 }, { width: 3000, height: 4000 }, 0);
    expect(crop.originX).toBeCloseTo((50 + 37.5) / 0.125);
    expect(crop.originY).toBeCloseTo(100 / 0.125);
    expect(crop.width).toBeCloseTo(200 / 0.125);
    expect(crop.height).toBeCloseTo(100 / 0.125);
  });

  it('adds padding but stays inside the photo', () => {
    const crop = frameToCrop({ x: 0, y: 0, w: 300, h: 500 }, { width: 300, height: 500 }, { width: 600, height: 1000 });
    expect(crop.originX).toBe(0);
    expect(crop.originY).toBe(0);
    expect(crop.originX + crop.width).toBeLessThanOrEqual(600);
    expect(crop.originY + crop.height).toBeLessThanOrEqual(1000);
  });
});
