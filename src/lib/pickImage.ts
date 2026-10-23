import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { t } from '@/i18n';
import { prepareImage } from '@/lib/images';
import type { ImageAttachment } from '@/lib/types';
import { toast } from '@/store/toast';

export interface CropSource {
  uri: string;
  width: number;
  height: number;
}

/** The photo open in the crop screen and who is waiting for the result. */
let session: { source: CropSource; resolve: (image: ImageAttachment | null) => void } | null = null;

export function pendingCropSource(): CropSource | null {
  return session?.source ?? null;
}

/** Called by the crop screen with the cropped photo, or null when the user backs out. */
export function finishCrop(image: ImageAttachment | null) {
  const current = session;
  session = null;
  current?.resolve(image);
}

/**
 * Picks a photo from the library, then opens the crop screen (drag to move, pinch to zoom,
 * drag the corners to resize). Resolves with the attachment, or null if either step is cancelled.
 */
export async function pickAndCropImage(): Promise<ImageAttachment | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;

  const size = { width: asset.width, height: asset.height };
  if (!size.width || !size.height) {
    // Without dimensions the crop frame can't be mapped to pixels; attach the whole photo.
    try {
      return await prepareImage(asset.uri, size);
    } catch {
      toast.error(t('chat.imageUnreadable'));
      return null;
    }
  }

  finishCrop(null);
  return new Promise((resolve) => {
    session = { source: { uri: asset.uri, ...size }, resolve };
    router.push('/crop');
  });
}
