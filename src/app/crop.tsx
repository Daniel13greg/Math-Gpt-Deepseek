import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { CropView } from '@/components/camera/CropView';
import { finishCrop, pendingCropSource } from '@/lib/pickImage';
import type { ImageAttachment } from '@/lib/types';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Crops a photo picked from the library. Opened by pickAndCropImage(), which receives the result. */
export default function CropScreen() {
  const [source] = useState(pendingCropSource);

  useEffect(() => {
    if (!source) close();
    // Leaving any other way (back button, swipe) cancels; a no-op once Done or Cancel finished it.
    return () => finishCrop(null);
  }, [source]);

  if (!source) return null;

  const finish = (image: ImageAttachment | null) => {
    finishCrop(image);
    close();
  };

  return <CropView source={source} onDone={finish} onCancel={() => finish(null)} />;
}
