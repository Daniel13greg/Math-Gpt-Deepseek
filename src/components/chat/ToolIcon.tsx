import type { ToolKind } from '@/constants/tools';
import {
  BookCheckIcon,
  BookIcon,
  ChartScatterIcon,
  CircleHelpIcon,
  FlashcardsIcon,
  PencilRulerIcon,
  PlayIcon,
} from '@/components/icons';

export function ToolIcon({
  kind,
  size = 24,
  color,
  strokeWidth = 1.8,
}: {
  kind: ToolKind;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const props = { size, color, strokeWidth };
  switch (kind) {
    case 'video':
      return <PlayIcon {...props} />;
    case 'practice-test':
      return <BookCheckIcon {...props} />;
    case 'practice-question':
      return <CircleHelpIcon {...props} />;
    case 'graph':
      return <ChartScatterIcon {...props} />;
    case 'diagram':
      return <PencilRulerIcon {...props} />;
    case 'study-guide':
      return <BookIcon {...props} />;
    case 'flashcards':
      return <FlashcardsIcon {...props} />;
  }
}
