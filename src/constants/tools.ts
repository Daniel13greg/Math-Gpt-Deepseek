import type { Params, StringKey } from '@/i18n/strings';

export type ToolKind =
  | 'check-work'
  | 'video'
  | 'practice-test'
  | 'practice-question'
  | 'graph'
  | 'diagram'
  | 'study-guide'
  | 'flashcards';

/** Tools that reply with streamed Markdown, like a chat answer, instead of an interactive artifact. */
export type TextToolKind = 'study-guide' | 'check-work';
export type ArtifactToolKind = Exclude<ToolKind, TextToolKind>;

export function isArtifactTool(kind: ToolKind): kind is ArtifactToolKind {
  return kind !== 'study-guide' && kind !== 'check-work';
}

export type DiagramKind = 'flowchart' | 'mindmap' | 'geometry' | 'free-body' | 'venn';

export interface ToolSelection {
  kind: ToolKind;
  diagram?: DiagramKind;
}

/** Order of the Tools sheet. Titles and placeholders live in the translations ("tool.<kind>.title"). */
export const TOOL_KINDS: ToolKind[] = [
  'check-work',
  'video',
  'practice-test',
  'practice-question',
  'graph',
  'diagram',
  'study-guide',
  'flashcards',
];

export const DIAGRAM_KINDS: DiagramKind[] = ['flowchart', 'mindmap', 'geometry', 'free-body', 'venn'];

type Translate = (key: StringKey, params?: Params) => string;

export function toolChipLabel(selection: ToolSelection, t: Translate): string {
  if (selection.kind === 'diagram' && selection.diagram) return t(`diagram.${selection.diagram}.title`);
  return t(`tool.${selection.kind}.chip`);
}

export function toolPlaceholder(selection: ToolSelection, t: Translate): string {
  if (selection.kind === 'diagram') return t(`diagram.${selection.diagram ?? 'flowchart'}.placeholder`);
  return t(`tool.${selection.kind}.placeholder`);
}

/** The visible message for a tool request, e.g. "Create a practice test on derivatives". */
export function toolRequestLabel(selection: ToolSelection, topic: string, t: Translate): string {
  const prefix = selection.kind === 'diagram' ? (`diagram.${selection.diagram ?? 'flowchart'}` as const) : (`tool.${selection.kind}` as const);
  return topic ? t(`${prefix}.request`, { topic }) : t(`${prefix}.requestBare`);
}
