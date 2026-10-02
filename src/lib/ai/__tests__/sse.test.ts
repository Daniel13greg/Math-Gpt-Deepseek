import { SSEParser } from '../sse';

describe('SSEParser', () => {
  it('parses complete messages and ignores comments', () => {
    const parser = new SSEParser();
    const out = parser.feed(': keep-alive\n\ndata: {"a":1}\n\ndata: [DONE]\n\n');
    expect(out).toEqual([{ data: '{"a":1}' }, { data: '[DONE]' }]);
  });

  it('handles messages split across arbitrary chunk boundaries', () => {
    const stream = 'data: {"x":"hello"}\n\ndata: {"x":"world"}\n\n';
    for (let size = 1; size <= stream.length; size++) {
      const parser = new SSEParser();
      const out = [];
      for (let i = 0; i < stream.length; i += size) out.push(...parser.feed(stream.slice(i, i + size)));
      out.push(...parser.end());
      expect(out.map((m) => m.data)).toEqual(['{"x":"hello"}', '{"x":"world"}']);
    }
  });

  it('supports CRLF line endings, including CR/LF split between chunks', () => {
    const parser = new SSEParser();
    const out = [...parser.feed('data: one\r'), ...parser.feed('\n\r\ndata: two\r\n\r\n')];
    expect(out.map((m) => m.data)).toEqual(['one', 'two']);
  });

  it('joins multi-line data and reads event names', () => {
    const parser = new SSEParser();
    const out = parser.feed('event: delta\ndata: line1\ndata: line2\n\n');
    expect(out).toEqual([{ event: 'delta', data: 'line1\nline2' }]);
  });

  it('flushes a trailing message without a blank line on end()', () => {
    const parser = new SSEParser();
    expect(parser.feed('data: tail')).toEqual([]);
    expect(parser.end()).toEqual([{ data: 'tail' }]);
  });
});
