import type { DOMImperativeFactory } from 'expo/dom';
import type { JSONValue } from 'expo/build/dom/dom.types';

/** Messages from the transcript WebView to native code. */
export type TranscriptAction =
  | { type: 'copy'; messageId: string }
  | { type: 'copy-text'; text: string }
  | { type: 'share'; messageId: string }
  | { type: 'speak'; messageId: string }
  | { type: 'regenerate'; messageId: string }
  | { type: 'edit'; messageId: string }
  | { type: 'open-artifact'; messageId: string }
  | { type: 'open-link'; url: string }
  | { type: 'open-image'; messageId: string; index: number }
  | { type: 'open-settings' }
  | { type: 'another-question'; messageId: string }
  | { type: 'answered'; correct: boolean };

export interface TranscriptHandle extends DOMImperativeFactory {
  /**
   * Streams the in-progress reply without re-sending the whole conversation over the bridge.
   * Called as patchMessage(id, content, reasoning); bridge methods must accept JSON values.
   */
  patchMessage: (...args: JSONValue[]) => void;
  scrollToBottom: (...args: JSONValue[]) => void;
}
