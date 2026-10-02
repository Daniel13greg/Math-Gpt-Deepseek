import { streamChat } from '@/lib/deepseek/client';
import { DeepSeekError } from '@/lib/deepseek/errors';
import { useNotes } from '@/store/notes';

import { generateLectureNotes } from '../generate';

jest.mock('@/lib/storage/kv', () => ({ kv: { getItemSync: () => null, setItem: () => {}, removeItem: () => {} } }));
jest.mock('@/lib/storage/secure', () => ({ secure: { getSync: () => 'sk-test', set: async () => {} } }));
jest.mock('@/lib/deepseek/client', () => ({ streamChat: jest.fn() }));

const stream = streamChat as jest.MockedFunction<typeof streamChat>;

const result = (content: string) => ({ content, reasoning: '', finishReason: 'stop' });

function noteWith(notes: string) {
  return useNotes.getState().createNote({ source: 'recording', transcript: 'Today: the power rule.', status: 'done', notes });
}

const get = (id: string) => useNotes.getState().notes[id];

describe('generateLectureNotes', () => {
  beforeEach(() => stream.mockReset());

  it('replaces the notes and title on success', async () => {
    const id = noteWith('# Old');
    stream.mockResolvedValue(result('# The Power Rule\n\nNotes'));
    await generateLectureNotes(id);
    expect(get(id)).toMatchObject({ notes: '# The Power Rule\n\nNotes', status: 'done', title: 'The Power Rule' });
  });

  it('shows the old notes until the new ones start arriving', async () => {
    const id = noteWith('# Old');
    let during: unknown;
    stream.mockImplementation(async () => {
      // Asserting in here would be swallowed: generateLectureNotes catches whatever the request throws.
      during = { notes: get(id).notes, status: get(id).status };
      return result('# New');
    });
    await generateLectureNotes(id);
    expect(during).toEqual({ notes: '# Old', status: 'generating' });
  });

  it('keeps the previous notes when regenerating fails', async () => {
    const id = noteWith('# Old');
    stream.mockImplementation(async (_config, _req, handlers) => {
      handlers?.onContent?.('# Half');
      throw new DeepSeekError('balance', 'Your DeepSeek account is out of credit.');
    });
    await generateLectureNotes(id);
    expect(get(id)).toMatchObject({
      notes: '# Old',
      status: 'error',
      error: 'Your DeepSeek account is out of credit. Your previous notes were kept.',
    });
  });

  it('restores the previous notes when regenerating is stopped', async () => {
    const id = noteWith('# Old');
    stream.mockRejectedValue(new DeepSeekError('aborted', 'Stopped.'));
    await generateLectureNotes(id);
    expect(get(id)).toMatchObject({ notes: '# Old', status: 'done', error: undefined });
  });

  it('keeps partial notes when a first generation fails', async () => {
    const id = noteWith('');
    stream.mockImplementation(async (_config, _req, handlers) => {
      handlers?.onContent?.('# Partial');
      throw new DeepSeekError('network', 'Network down');
    });
    await generateLectureNotes(id);
    expect(get(id)).toMatchObject({ notes: '# Partial', status: 'error', error: 'Network down' });
  });
});
