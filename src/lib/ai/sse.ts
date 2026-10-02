export interface SSEMessage {
  event?: string;
  data: string;
}

/**
 * Incremental Server-Sent Events parser (https://html.spec.whatwg.org/#event-stream-interpretation).
 *
 * Feed it decoded text in arbitrary chunks; it returns every complete message.
 * Comment lines (`: keep-alive`, which the server sends while a request is queued)
 * are ignored.
 */
export class SSEParser {
  private buffer = '';
  private dataLines: string[] = [];
  private eventName: string | undefined;

  feed(chunk: string): SSEMessage[] {
    this.buffer += chunk;
    const messages: SSEMessage[] = [];

    let newline: number;
    while ((newline = this.findLineEnd()) !== -1) {
      const line = this.buffer.slice(0, newline);
      // Consume "\r\n" as one terminator.
      const terminatorLength = this.buffer[newline] === '\r' && this.buffer[newline + 1] === '\n' ? 2 : 1;
      this.buffer = this.buffer.slice(newline + terminatorLength);
      this.processLine(line, messages);
    }
    return messages;
  }

  /** Flush a trailing message that wasn't followed by a blank line. */
  end(): SSEMessage[] {
    const messages: SSEMessage[] = [];
    if (this.buffer.length > 0) {
      this.processLine(this.buffer, messages);
      this.buffer = '';
    }
    this.dispatch(messages);
    return messages;
  }

  private findLineEnd(): number {
    const lf = this.buffer.indexOf('\n');
    const cr = this.buffer.indexOf('\r');
    if (cr === -1) return lf;
    // A lone "\r" at the very end may be the first half of "\r\n": wait for more input.
    if (cr === this.buffer.length - 1) return lf === -1 ? -1 : Math.min(lf, cr);
    if (lf === -1) return cr;
    return Math.min(lf, cr);
  }

  private processLine(line: string, out: SSEMessage[]) {
    if (line === '') {
      this.dispatch(out);
      return;
    }
    if (line.startsWith(':')) return;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'data') this.dataLines.push(value);
    else if (field === 'event') this.eventName = value;
  }

  private dispatch(out: SSEMessage[]) {
    if (this.dataLines.length > 0) {
      out.push({ event: this.eventName, data: this.dataLines.join('\n') });
    }
    this.dataLines = [];
    this.eventName = undefined;
  }
}
