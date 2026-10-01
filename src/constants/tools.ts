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

export interface ToolInfo {
  kind: ToolKind;
  /** Label in the Tools sheet. */
  title: string;
  /** Short label for the chip shown in the composer. */
  chip: string;
  /** Composer placeholder while the tool is selected. */
  placeholder: string;
  /** Verb phrase used to build the visible user message, e.g. "Create a practice test on". */
  request: string;
}

export const TOOLS: ToolInfo[] = [
  {
    kind: 'check-work',
    title: 'Check My Work',
    chip: 'Check My Work',
    placeholder: 'Add a photo of your working, or type it here',
    request: 'Check my work',
  },
  {
    kind: 'video',
    title: 'Create Video',
    chip: 'Video',
    placeholder: 'What should the video explain?',
    request: 'Create a video lesson about',
  },
  {
    kind: 'practice-test',
    title: 'Create Practice Test',
    chip: 'Practice Test',
    placeholder: 'Topic for your practice test',
    request: 'Create a practice test on',
  },
  {
    kind: 'practice-question',
    title: 'Create Practice Question',
    chip: 'Practice Question',
    placeholder: 'Topic for a practice question',
    request: 'Create a practice question on',
  },
  {
    kind: 'graph',
    title: 'Create Graph',
    chip: 'Graph',
    placeholder: 'What should I graph? e.g. y = x^2 - 4',
    request: 'Graph',
  },
  {
    kind: 'diagram',
    title: 'Create Diagram',
    chip: 'Diagram',
    placeholder: 'Describe the diagram you need',
    request: 'Create a diagram of',
  },
  {
    kind: 'study-guide',
    title: 'Create Study Guide',
    chip: 'Study Guide',
    placeholder: 'Topic for your study guide',
    request: 'Create a study guide on',
  },
  {
    kind: 'flashcards',
    title: 'Create Flashcards',
    chip: 'Flashcards',
    placeholder: 'Topic for your flashcards',
    request: 'Create flashcards on',
  },
];

export const DIAGRAM_KINDS: { kind: DiagramKind; title: string; placeholder: string }[] = [
  { kind: 'flowchart', title: 'Flowchart', placeholder: 'Process to map, e.g. solving a quadratic' },
  { kind: 'mindmap', title: 'Mind Map', placeholder: 'Topic to map, e.g. cell biology' },
  { kind: 'geometry', title: 'Geometry Figure', placeholder: 'Figure to draw, e.g. inscribed angle theorem' },
  { kind: 'free-body', title: 'Free-Body Diagram', placeholder: 'Situation, e.g. block on a 30° incline' },
  { kind: 'venn', title: 'Venn Diagram', placeholder: 'Sets to compare, e.g. mitosis vs meiosis' },
];

export function getTool(kind: ToolKind): ToolInfo {
  const tool = TOOLS.find((t) => t.kind === kind);
  if (!tool) throw new Error(`Unknown tool: ${kind}`);
  return tool;
}

export function getDiagramKind(kind: DiagramKind | undefined) {
  return DIAGRAM_KINDS.find((d) => d.kind === kind) ?? DIAGRAM_KINDS[0];
}

export function toolChipLabel(selection: ToolSelection): string {
  if (selection.kind === 'diagram' && selection.diagram) return getDiagramKind(selection.diagram).title;
  return getTool(selection.kind).chip;
}

export function toolPlaceholder(selection: ToolSelection): string {
  if (selection.kind === 'diagram') return getDiagramKind(selection.diagram).placeholder;
  return getTool(selection.kind).placeholder;
}
