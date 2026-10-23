import type { CropRect } from '@/lib/images';

/**
 * Maps the crop screen's frame to photo pixels. `image` is where the photo currently sits on screen
 * (after zooming and panning); the result is clamped to the photo.
 */
export function frameToImageCrop(
  frame: { x: number; y: number; w: number; h: number },
  image: { left: number; top: number; width: number; height: number },
  photo: { width: number; height: number },
): CropRect {
  const scale = photo.width / image.width;
  const originX = Math.min(photo.width, Math.max(0, (frame.x - image.left) * scale));
  const originY = Math.min(photo.height, Math.max(0, (frame.y - image.top) * scale));
  return {
    originX,
    originY,
    width: Math.min(photo.width - originX, frame.w * scale),
    height: Math.min(photo.height - originY, frame.h * scale),
  };
}

/** Maps the on-screen frame to photo pixels, assuming the preview fills the view ("cover"). */
export function frameToCrop(
  frame: { x: number; y: number; w: number; h: number },
  view: { width: number; height: number },
  photo: { width: number; height: number },
  padding = 0.04,
): CropRect {
  const scale = Math.max(view.width / photo.width, view.height / photo.height);
  const offsetX = (photo.width * scale - view.width) / 2;
  const offsetY = (photo.height * scale - view.height) / 2;
  const padX = frame.w * padding;
  const padY = frame.h * padding;
  const originX = Math.max(0, (frame.x - padX + offsetX) / scale);
  const originY = Math.max(0, (frame.y - padY + offsetY) / scale);
  return {
    originX,
    originY,
    width: Math.min(photo.width - originX, (frame.w + padX * 2) / scale),
    height: Math.min(photo.height - originY, (frame.h + padY * 2) / scale),
  };
}
