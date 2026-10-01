/* Icon paths from Lucide (ISC license, https://lucide.dev), inlined for DOM components. */

export type IconNode = [string, Record<string, string>][];

export const ICONS = {
  copy: [
    ['rect', { width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2' }],
    ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }],
  ] as IconNode,
  share2: [
    ['circle', { cx: '18', cy: '5', r: '3' }],
    ['circle', { cx: '6', cy: '12', r: '3' }],
    ['circle', { cx: '18', cy: '19', r: '3' }],
    ['line', { x1: '8.59', x2: '15.42', y1: '13.51', y2: '17.49' }],
    ['line', { x1: '15.41', x2: '8.59', y1: '6.51', y2: '10.49' }],
  ] as IconNode,
  refreshCw: [
    ['path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }],
    ['path', { d: 'M21 3v5h-5' }],
    ['path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' }],
    ['path', { d: 'M8 16H3v5' }],
  ] as IconNode,
  volume2: [
    [
      'path',
      {
        d: 'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z',
      },
    ],
    ['path', { d: 'M16 9a5 5 0 0 1 0 6' }],
    ['path', { d: 'M19.364 18.364a9 9 0 0 0 0-12.728' }],
  ] as IconNode,
  check: [['path', { d: 'M20 6 9 17l-5-5' }]] as IconNode,
  clipboardCheck: [
    ['rect', { width: '8', height: '4', x: '8', y: '2', rx: '1', ry: '1' }],
    ['path', { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' }],
    ['path', { d: 'm9 14 2 2 4-4' }],
  ] as IconNode,
  x: [
    ['path', { d: 'M18 6 6 18' }],
    ['path', { d: 'm6 6 12 12' }],
  ] as IconNode,
  play: [['path', { d: 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z' }]] as IconNode,
  pause: [
    ['rect', { x: '14', y: '3', width: '5', height: '18', rx: '1' }],
    ['rect', { x: '5', y: '3', width: '5', height: '18', rx: '1' }],
  ] as IconNode,
  chevronDown: [['path', { d: 'm6 9 6 6 6-6' }]] as IconNode,
  chevronRight: [['path', { d: 'm9 18 6-6-6-6' }]] as IconNode,
  chevronLeft: [['path', { d: 'm15 18-6-6 6-6' }]] as IconNode,
  brain: [
    ['path', { d: 'M12 18V5' }],
    ['path', { d: 'M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4' }],
    ['path', { d: 'M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5' }],
    ['path', { d: 'M17.997 5.125a4 4 0 0 1 2.526 5.77' }],
    ['path', { d: 'M18 18a4 4 0 0 0 2-7.464' }],
    ['path', { d: 'M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517' }],
    ['path', { d: 'M6 18a4 4 0 0 1-2-7.464' }],
    ['path', { d: 'M6.003 5.125a4 4 0 0 0-2.526 5.77' }],
  ] as IconNode,
  lightbulb: [
    ['path', { d: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5' }],
    ['path', { d: 'M9 18h6' }],
    ['path', { d: 'M10 22h4' }],
  ] as IconNode,
  bookOpen: [
    ['path', { d: 'M12 5v16' }],
    [
      'path',
      {
        d: 'M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z',
      },
    ],
  ] as IconNode,
  zoomIn: [
    ['circle', { cx: '11', cy: '11', r: '8' }],
    ['line', { x1: '21', x2: '16.65', y1: '21', y2: '16.65' }],
    ['line', { x1: '11', x2: '11', y1: '8', y2: '14' }],
    ['line', { x1: '8', x2: '14', y1: '11', y2: '11' }],
  ] as IconNode,
  zoomOut: [
    ['circle', { cx: '11', cy: '11', r: '8' }],
    ['line', { x1: '21', x2: '16.65', y1: '21', y2: '16.65' }],
    ['line', { x1: '8', x2: '14', y1: '11', y2: '11' }],
  ] as IconNode,
  maximize2: [
    ['path', { d: 'M15 3h6v6' }],
    ['path', { d: 'm21 3-7 7' }],
    ['path', { d: 'm3 21 7-7' }],
    ['path', { d: 'M9 21H3v-6' }],
  ] as IconNode,
  shuffle: [
    ['path', { d: 'm18 14 4 4-4 4' }],
    ['path', { d: 'm18 2 4 4-4 4' }],
    ['path', { d: 'M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22' }],
    ['path', { d: 'M2 6h1.972a4 4 0 0 1 3.6 2.2' }],
    ['path', { d: 'M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45' }],
  ] as IconNode,
  rotateCcw: [
    ['path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }],
    ['path', { d: 'M3 3v5h5' }],
  ] as IconNode,
  settings: [
    [
      'path',
      {
        d: 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915',
      },
    ],
    ['circle', { cx: '12', cy: '12', r: '3' }],
  ] as IconNode,
  circleAlert: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['line', { x1: '12', x2: '12', y1: '8', y2: '12' }],
    ['line', { x1: '12', x2: '12.01', y1: '16', y2: '16' }],
  ] as IconNode,
  square: [['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }]] as IconNode,
  sparkles: [
    [
      'path',
      {
        d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z',
      },
    ],
    ['path', { d: 'M20 2v4' }],
    ['path', { d: 'M22 4h-4' }],
    ['circle', { cx: '4', cy: '20', r: '2' }],
  ] as IconNode,
  bookCheck: [
    ['path', { d: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20' }],
    ['path', { d: 'm9 9.5 2 2 4-4' }],
  ] as IconNode,
  chartScatter: [
    ['circle', { cx: '7.5', cy: '7.5', r: '.5', fill: 'currentColor' }],
    ['circle', { cx: '18.5', cy: '5.5', r: '.5', fill: 'currentColor' }],
    ['circle', { cx: '11.5', cy: '11.5', r: '.5', fill: 'currentColor' }],
    ['circle', { cx: '7.5', cy: '16.5', r: '.5', fill: 'currentColor' }],
    ['circle', { cx: '17.5', cy: '14.5', r: '.5', fill: 'currentColor' }],
    ['path', { d: 'M3 3v16a2 2 0 0 0 2 2h16' }],
  ] as IconNode,
  pencilRuler: [
    ['path', { d: 'M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13' }],
    ['path', { d: 'm8 6 2-2' }],
    ['path', { d: 'm18 16 2-2' }],
    ['path', { d: 'm17 11 4.3 4.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17' }],
    [
      'path',
      {
        d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
      },
    ],
    ['path', { d: 'm15 5 4 4' }],
  ] as IconNode,
  circleQuestionMark: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' }],
    ['path', { d: 'M12 17h.01' }],
  ] as IconNode,
  clock: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M12 6v6l4 2' }],
  ] as IconNode,
  trophy: [
    ['path', { d: 'M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2' }],
    ['path', { d: 'M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2' }],
    ['path', { d: 'M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3' }],
    ['path', { d: 'M4 22h16' }],
    ['path', { d: 'M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z' }],
    ['path', { d: 'M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3' }],
  ] as IconNode,
  arrowRight: [
    ['path', { d: 'M5 12h14' }],
    ['path', { d: 'm12 5 7 7-7 7' }],
  ] as IconNode,
  pencil: [
    [
      'path',
      {
        d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
      },
    ],
    ['path', { d: 'm15 5 4 4' }],
  ] as IconNode,
  flashcards: [
    ['path', { d: 'm7.18 20.827-5-11a2 2 0 0 1 .993-2.647L7 5.44' }],
    ['rect', { x: '7', y: '2', width: '14', height: '20', rx: '2' }],
  ] as IconNode,
};

export type IconName = keyof typeof ICONS;
