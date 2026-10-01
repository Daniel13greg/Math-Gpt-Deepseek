import type { ResolvedSharePayload, SharePayload } from 'expo-sharing';

/** What another app shared with us, reduced to what the composer can use. */
export interface ShareIntake {
  imageUris: string[];
  text: string;
}

/** Picks the shared images (up to four) and joins shared text and links into one draft. */
export function readSharePayloads(raw: SharePayload[], resolved: ResolvedSharePayload[]): ShareIntake {
  const imageUris: string[] = [];
  const texts: string[] = [];
  raw.forEach((payload, i) => {
    const r = resolved[i];
    const isImage = r?.contentType === 'image' || payload.shareType === 'image' || /^image\//.test(payload.mimeType ?? '');
    if (isImage) {
      const uri = (r && 'contentUri' in r && r.contentUri) || payload.value;
      if (uri) imageUris.push(uri);
    } else if ((payload.shareType === 'text' || payload.shareType === 'url') && payload.value.trim()) {
      texts.push(payload.value.trim());
    }
  });
  return { imageUris: imageUris.slice(0, 4), text: texts.join('\n\n') };
}
