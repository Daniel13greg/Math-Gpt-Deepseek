import * as Sharing from 'expo-sharing';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { imageSize, prepareImage } from '@/lib/images';
import { readSharePayloads } from '@/lib/shareIntake';
import { toast } from '@/store/toast';
import { useUI } from '@/store/ui';

/** Moves photos and text shared from other apps (the system share sheet) into the composer. */
async function takeShared(): Promise<void> {
  let raw: Sharing.SharePayload[] = [];
  try {
    raw = Sharing.getSharedPayloads();
  } catch {
    return; // No share-receiving support in this build (e.g. Expo Go).
  }
  if (raw.length === 0) return;

  let resolved: Sharing.ResolvedSharePayload[] = [];
  try {
    resolved = await Sharing.getResolvedSharedPayloadsAsync();
  } catch {
    // Raw payloads still carry the file URIs and text.
  }
  try {
    Sharing.clearSharedPayloads();
  } catch {
    // Best effort; payloads are compared before reuse anyway.
  }

  const { imageUris, text } = readSharePayloads(raw, resolved);
  const ui = useUI.getState();
  let added = 0;
  for (const uri of imageUris) {
    try {
      ui.addPendingImage(await prepareImage(uri, await imageSize(uri)));
      added++;
    } catch {
      // Skip images we can't read.
    }
  }
  if (text) ui.setDraft(ui.draft.trim() ? `${ui.draft.trim()}\n\n${text}` : text);
  if (added === 0 && !text) {
    if (imageUris.length) toast.error("Couldn't read the shared image.");
    return;
  }
  ui.setMode('chat');
  toast.success(added ? 'Photo added. Tap send to solve it.' : 'Added to your question.');
}

export function useShareIntake() {
  useEffect(() => {
    let running = false;
    const check = () => {
      if (running) return;
      running = true;
      takeShared().finally(() => (running = false));
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => subscription.remove();
  }, []);
}
