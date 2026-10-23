import { frameToCrop, frameToImageCrop } from '@/lib/cropFrame';

describe('frameToImageCrop', () => {
  it('maps the frame through a zoomed and moved photo', () => {
    // 2000x1000 photo drawn 800x400 on screen (0.4 px per pixel) with its top-left at (-100, 50).
    const crop = frameToImageCrop(
      { x: 100, y: 90, w: 200, h: 100 },
      { left: -100, top: 50, width: 800, height: 400 },
      { width: 2000, height: 1000 },
    );
    expect(crop).toEqual({ originX: 500, originY: 100, width: 500, height: 250 });
  });

  it('returns the whole photo when the frame covers it exactly', () => {
    const crop = frameToImageCrop(
      { x: 24, y: 80, w: 300, h: 400 },
      { left: 24, top: 80, width: 300, height: 400 },
      { width: 3000, height: 4000 },
    );
    expect(crop.originX).toBeCloseTo(0);
    expect(crop.originY).toBeCloseTo(0);
    expect(crop.width).toBeCloseTo(3000);
    expect(crop.height).toBeCloseTo(4000);
  });

  it('stays inside the photo', () => {
    const crop = frameToImageCrop(
      { x: 0, y: 0, w: 500, h: 500 },
      { left: 10, top: 10, width: 400, height: 400 },
      { width: 400, height: 400 },
    );
    expect(crop.originX).toBe(0);
    expect(crop.originX + crop.width).toBeLessThanOrEqual(400);
    expect(crop.originY + crop.height).toBeLessThanOrEqual(400);
  });
});

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
