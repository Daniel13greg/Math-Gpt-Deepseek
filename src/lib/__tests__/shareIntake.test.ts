import { readSharePayloads } from '../shareIntake';

describe('readSharePayloads', () => {
  it('takes image URIs (preferring resolved ones) and joins text', () => {
    const intake = readSharePayloads(
      [
        { value: 'content://media/1', shareType: 'image', mimeType: 'image/jpeg' },
        { value: 'Solve question 4', shareType: 'text' },
        { value: 'https://example.com/hw', shareType: 'url' },
        { value: 'file:///cache/2.png', shareType: 'file', mimeType: 'image/png' },
      ],
      [
        {
          value: 'content://media/1',
          shareType: 'image',
          contentType: 'image',
          contentUri: 'file:///copy/1.jpg',
          contentMimeType: 'image/jpeg',
          originalName: '1.jpg',
          contentSize: 10,
        },
      ],
    );
    expect(intake.imageUris).toEqual(['file:///copy/1.jpg', 'file:///cache/2.png']);
    expect(intake.text).toBe('Solve question 4\n\nhttps://example.com/hw');
  });

  it('keeps at most four images and ignores empty text', () => {
    const images = Array.from({ length: 6 }, (_, i) => ({ value: `file:///${i}.jpg`, shareType: 'image' as const }));
    const intake = readSharePayloads([...images, { value: '  ', shareType: 'text' }], []);
    expect(intake.imageUris).toHaveLength(4);
    expect(intake.text).toBe('');
  });
});
