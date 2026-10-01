import { Platform } from 'react-native';

/** Brand blue sampled from the MathGPT Upgrade / send buttons. */
export const BRAND_BLUE = '#3490DD';

export const Colors = {
  light: {
    background: '#FFFFFF',
    text: '#0A0A0A',
    textStrong: '#000000',
    icon: '#232323',
    // Secondary and muted text meet WCAG AA contrast (4.5:1) on the light backgrounds.
    textSecondary: '#6E6E6E',
    textMuted: '#6A707B',
    textFaint: '#C6CAD1',
    tabInactive: '#C9C9C9',
    segmentBg: '#F3F3F3',
    segmentSelected: '#FFFFFF',
    segmentText: '#575757',
    border: '#E6E7EB',
    hairline: '#F0F0F0',
    card: '#FFFFFF',
    cardBorder: '#E7E7E7',
    surface: '#F4F4F5',
    surfacePressed: '#EAEAEC',
    dropzoneBg: '#FCFCFC',
    dropzoneBorder: '#C9C9C9',
    fileCircle: '#F1F1F1',
    fileIcon: '#A6A6A6',
    uploadText: '#505050',
    formatsText: '#AAAAAA',
    dividerText: '#999999',
    divider: '#EBEBEB',
    backdrop: 'rgba(0,0,0,0.10)',
    grabber: '#8B8B8B',
    primary: BRAND_BLUE,
    primaryPressed: '#2B7CC2',
    primarySoft: '#E8F2FC',
    onPrimary: '#FFFFFF',
    recordButton: '#000000',
    onRecordButton: '#FFFFFF',
    recordDot: '#F22E52',
    recordRing: '#3C171F',
    danger: '#E5484D',
    dangerSoft: '#FDECEC',
    success: '#2F9E5E',
    shadow: '#000000',
    cameraOverlay: 'rgba(0,0,0,0.45)',
  },
  dark: {
    background: '#0E0F11',
    text: '#ECEDEE',
    textStrong: '#FFFFFF',
    icon: '#E4E5E7',
    textSecondary: '#A0A4AB',
    textMuted: '#8B919A',
    textFaint: '#4C5058',
    tabInactive: '#5A5E66',
    segmentBg: '#1C1D21',
    segmentSelected: '#2C2E33',
    segmentText: '#C6C8CC',
    border: '#2A2C31',
    hairline: '#1E2024',
    card: '#16171A',
    cardBorder: '#2A2C31',
    surface: '#1D1F23',
    surfacePressed: '#26282D',
    dropzoneBg: '#141518',
    dropzoneBorder: '#3A3D44',
    fileCircle: '#24262B',
    fileIcon: '#80858E',
    uploadText: '#C8CACE',
    formatsText: '#71767F',
    dividerText: '#71767F',
    divider: '#26282D',
    backdrop: 'rgba(0,0,0,0.55)',
    grabber: '#5C6068',
    primary: BRAND_BLUE,
    primaryPressed: '#2B7CC2',
    primarySoft: '#16283A',
    onPrimary: '#FFFFFF',
    recordButton: '#FFFFFF',
    onRecordButton: '#000000',
    recordDot: '#F22E52',
    recordRing: '#F7C5CF',
    danger: '#F16A6E',
    dangerSoft: '#3A1D1F',
    success: '#4CC38A',
    shadow: '#000000',
    cameraOverlay: 'rgba(0,0,0,0.55)',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };
export type ColorSchemeName = keyof typeof Colors;

/** Inter is loaded at startup (see app/_layout.tsx). Android needs one family per weight. */
export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type FontWeightName = keyof typeof FontFamily;

export const MonoFont = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/** Max width for content on tablets / web so lines stay readable. */
export const MaxContentWidth = 760;
