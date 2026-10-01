import { AppState } from 'react-native';

import { kv } from './kv';

/**
 * Persists a `Record<id, item>` as one key per item plus an index key.
 *
 * Items are immutable in our stores, so a changed object reference means the item
 * changed: only those are re-serialized. Saves are throttled (streaming updates the
 * active chat many times per second) and flushed when the app goes to background.
 */
export function loadCollection<T>(prefix: string): Record<string, T> {
  const out: Record<string, T> = {};
  let ids: string[] = [];
  try {
    ids = JSON.parse(kv.getItemSync(`${prefix}:index`) ?? '[]');
  } catch {
    ids = [];
  }
  for (const id of ids) {
    const raw = kv.getItemSync(`${prefix}:${id}`);
    if (!raw) continue;
    try {
      out[id] = JSON.parse(raw) as T;
    } catch {
      // Skip corrupt entries rather than failing the whole app.
    }
  }
  return out;
}

export function createCollectionSaver<T>(prefix: string, initial: Record<string, T>, intervalMs = 1200) {
  let saved = initial;
  let latest = initial;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const current = latest;
    if (current === saved) return;
    for (const id of Object.keys(current)) {
      if (current[id] !== saved[id]) kv.setItem(`${prefix}:${id}`, JSON.stringify(current[id]));
    }
    for (const id of Object.keys(saved)) {
      if (!(id in current)) kv.removeItem(`${prefix}:${id}`);
    }
    const ids = Object.keys(current);
    const savedIds = Object.keys(saved);
    if (ids.length !== savedIds.length || ids.some((id, i) => id !== savedIds[i])) {
      kv.setItem(`${prefix}:index`, JSON.stringify(ids));
    }
    saved = current;
  };

  AppState.addEventListener('change', (state) => {
    if (state !== 'active') flush();
  });

  return {
    schedule(current: Record<string, T>) {
      latest = current;
      if (!timer) timer = setTimeout(flush, intervalMs);
    },
    flush,
  };
}
