import { deleteImageFiles } from '@/lib/images';
import type { ImageAttachment } from '@/lib/types';
import { useChats } from '@/store/chats';

import { deleteAllChatsWithFiles } from '../controller';

jest.mock('@/lib/storage/kv', () => ({ kv: { getItemSync: () => null, setItem: () => {}, removeItem: () => {} } }));
jest.mock('@/lib/storage/secure', () => ({ secure: { getSync: () => null, set: async () => {} } }));
jest.mock('@/lib/images', () => ({ deleteImageFiles: jest.fn(), imageToDataUrl: jest.fn() }));

const image = (id: string): ImageAttachment => ({ id, uri: `file:///${id}.jpg`, thumb: 'data:thumb', width: 10, height: 10 });

describe('deleteAllChatsWithFiles', () => {
  it('deletes every chat and the photos attached to them', () => {
    const store = useChats.getState();
    const a = store.createChat('math');
    store.addMessage(a, { id: 'u1', role: 'user', text: '', createdAt: 1, images: [image('p1')] });
    store.addMessage(a, { id: 'a1', role: 'assistant', content: 'Solved', status: 'done', createdAt: 2 });
    const b = store.createChat('physics');
    store.addMessage(b, { id: 'u2', role: 'user', text: 'And these?', createdAt: 3, images: [image('p2'), image('p3')] });

    deleteAllChatsWithFiles();

    expect(useChats.getState().chats).toEqual({});
    expect(useChats.getState().activeChatId).toBeNull();
    const deleted = (deleteImageFiles as jest.Mock).mock.calls.flatMap(([images]) => images ?? []).map((i) => i.id);
    expect(deleted.sort()).toEqual(['p1', 'p2', 'p3']);
  });
});
