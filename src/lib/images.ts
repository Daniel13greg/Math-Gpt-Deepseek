import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { makeId } from '@/lib/id';
import type { ImageAttachment } from '@/lib/types';

/**
 * The vision model downsamples images to roughly 800×800 pixels' worth, so anything much
 * larger only costs upload time. Keep enough detail for small handwriting.
 */
const MAX_SIDE = 1600;
const THUMB_WIDTH = 360;

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

function imagesDir(): Directory {
  const dir = new Directory(Paths.document, 'images');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Crops (optionally), downsizes and stores an image, returning an attachment ready to send. */
export async function prepareImage(
  sourceUri: string,
  size: { width: number; height: number },
  crop?: CropRect,
): Promise<ImageAttachment> {
  const ctx = ImageManipulator.manipulate(sourceUri);
  let width = size.width;
  let height = size.height;
  if (crop && crop.width > 0 && crop.height > 0) {
    const rect = {
      originX: Math.max(0, Math.round(crop.originX)),
      originY: Math.max(0, Math.round(crop.originY)),
      width: Math.round(Math.min(crop.width, size.width - Math.max(0, crop.originX))),
      height: Math.round(Math.min(crop.height, size.height - Math.max(0, crop.originY))),
    };
    ctx.crop(rect);
    width = rect.width;
    height = rect.height;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  if (scale < 1) ctx.resize({ width: Math.round(width * scale) });

  const ref = await ctx.renderAsync();
  const isWeb = Platform.OS === 'web';
  const main = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: isWeb });

  const thumbRef = await ImageManipulator.manipulate(main.uri).resize({ width: THUMB_WIDTH }).renderAsync();
  const thumb = await thumbRef.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });

  const id = makeId('img');
  let uri = main.uri;
  if (isWeb) {
    uri = `data:image/jpeg;base64,${main.base64}`;
  } else {
    // The manipulator writes to the cache, which the OS may purge; keep a durable copy.
    const target = new File(imagesDir(), `${id}.jpg`);
    await new File(main.uri).copy(target);
    uri = target.uri;
  }

  return {
    id,
    uri,
    thumb: `data:image/jpeg;base64,${thumb.base64}`,
    width: main.width,
    height: main.height,
  };
}

/** Base64 data URL for the API's `image_url` content part. */
export async function imageToDataUrl(image: ImageAttachment): Promise<string> {
  if (image.uri.startsWith('data:')) return image.uri;
  try {
    return `data:image/jpeg;base64,${await new File(image.uri).base64()}`;
  } catch {
    // The full image is gone (e.g. app data restored without files); the thumbnail still works.
    return image.thumb;
  }
}

export function deleteImageFiles(images: ImageAttachment[] | undefined) {
  if (!images || Platform.OS === 'web') return;
  for (const image of images) {
    try {
      const file = new File(image.uri);
      if (file.exists) file.delete();
    } catch {
      // Best effort.
    }
  }
}
