import Svg, { Path, Rect } from 'react-native-svg';

// Individual imports keep the bundle from pulling in all ~3,700 Lucide icons.
export { default as ArrowUpIcon } from 'lucide-react-native/icons/arrow-up';
export { default as BookIcon } from 'lucide-react-native/icons/book';
export { default as BookCheckIcon } from 'lucide-react-native/icons/book-check';
export { default as BrainIcon } from 'lucide-react-native/icons/brain';
export { default as CameraIcon } from 'lucide-react-native/icons/camera';
export { default as ChartScatterIcon } from 'lucide-react-native/icons/chart-scatter';
export { default as CheckIcon } from 'lucide-react-native/icons/check';
export { default as ChevronDownIcon } from 'lucide-react-native/icons/chevron-down';
export { default as ChevronLeftIcon } from 'lucide-react-native/icons/chevron-left';
export { default as ChevronRightIcon } from 'lucide-react-native/icons/chevron-right';
export { default as CircleHelpIcon } from 'lucide-react-native/icons/circle-question-mark';
export { default as ClipboardCheckIcon } from 'lucide-react-native/icons/clipboard-check';
export { default as CopyIcon } from 'lucide-react-native/icons/copy';
export { default as FileIcon } from 'lucide-react-native/icons/file';
export { default as FileDownIcon } from 'lucide-react-native/icons/file-down';
export { default as FileTextIcon } from 'lucide-react-native/icons/file-text';
export { default as GraduationCapIcon } from 'lucide-react-native/icons/graduation-cap';
export { default as ImageIcon } from 'lucide-react-native/icons/image';
export { default as KeyboardIcon } from 'lucide-react-native/icons/keyboard';
export { default as KeyRoundIcon } from 'lucide-react-native/icons/key-round';
export { default as LayersIcon } from 'lucide-react-native/icons/layers';
export { default as MessageCircleQuestionIcon } from 'lucide-react-native/icons/message-circle-question-mark';
export { default as MicIcon } from 'lucide-react-native/icons/mic';
export { default as NotebookPenIcon } from 'lucide-react-native/icons/notebook-pen';
export { default as PauseIcon } from 'lucide-react-native/icons/pause';
export { default as PencilIcon } from 'lucide-react-native/icons/pencil';
export { default as PencilRulerIcon } from 'lucide-react-native/icons/pencil-ruler';
export { default as PlayIcon } from 'lucide-react-native/icons/play';
export { default as PlusIcon } from 'lucide-react-native/icons/plus';
export { default as RefreshIcon } from 'lucide-react-native/icons/refresh-cw';
export { default as RotateCcwIcon } from 'lucide-react-native/icons/rotate-ccw';
export { default as SearchIcon } from 'lucide-react-native/icons/search';
export { default as SettingsIcon } from 'lucide-react-native/icons/settings';
export { default as ShareIcon } from 'lucide-react-native/icons/share-2';
export { default as ShuffleIcon } from 'lucide-react-native/icons/shuffle';
export { default as SigmaIcon } from 'lucide-react-native/icons/sigma';
export { default as SkipBackIcon } from 'lucide-react-native/icons/skip-back';
export { default as SkipForwardIcon } from 'lucide-react-native/icons/skip-forward';
export { default as SparklesIcon } from 'lucide-react-native/icons/sparkles';
export { default as SquareIcon } from 'lucide-react-native/icons/square';
export { default as SquarePenIcon } from 'lucide-react-native/icons/square-pen';
export { default as ToolCaseIcon } from 'lucide-react-native/icons/tool-case';
export { default as Trash2Icon } from 'lucide-react-native/icons/trash';
export { default as Volume2Icon } from 'lucide-react-native/icons/volume-2';
export { default as XIcon } from 'lucide-react-native/icons/x';
export { default as ZapIcon } from 'lucide-react-native/icons/zap';
export { default as ZapOffIcon } from 'lucide-react-native/icons/zap-off';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** The MathGPT menu glyph: three bars of decreasing / uneven length. */
export function MenuIcon({ size = 24, color = '#232323', strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2.5 5.5h19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M2.5 12h10.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M2.5 18.5h15.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** Two stacked cards (Lucide "playing-cards" without the suit). */
export function FlashcardsIcon({ size = 24, color = '#232323', strokeWidth = 2 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Path d="m7.18 20.827-5-11a2 2 0 0 1 .993-2.647L7 5.44" />
      <Rect x={7} y={2} width={14} height={20} rx={2} />
    </Svg>
  );
}
