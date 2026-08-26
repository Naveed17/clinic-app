import {
  type BrandVariants,
  type Theme,
  createDarkTheme,
  createLightTheme,
} from '@fluentui/react-components';

/**
 * CareFlow brand ramp — Teal / Emerald palette inspired by
 * the premium CoachPro design language.
 * @see https://fluent2.microsoft.design/get-started/develop
 */
const careFlowBrand: BrandVariants = {
  10: '#042f2e',
  20: '#064e3b',
  30: '#065f46',
  40: '#047857',
  50: '#059669',
  60: '#0D9488',
  70: '#10B981',
  80: '#34D399',
  90: '#6EE7B7',
  100: '#A7F3D0',
  110: '#D1FAE5',
  120: '#E6FAF0',
  130: '#ECFDF5',
  140: '#F0FDF9',
  150: '#F5FFFC',
  160: '#ffffff',
};

const light = createLightTheme(careFlowBrand);
const dark = createDarkTheme(careFlowBrand);

/**
 * Fluent light theme — Premium CoachPro aesthetic.
 * Canvas: #EBF1F5, Cards: #FFFFFF, Strokes: ultra-thin #E2E8F0.
 * Brand: Teal #0D9488, Text: deep slate #1E293B.
 */
export const careFlowLightTheme: Theme = {
  ...light,
  /* Surfaces */
  colorNeutralBackground1: '#ffffff',
  colorNeutralBackground2: '#EBF1F5',
  colorNeutralBackground3: '#F1F5F9',
  colorNeutralBackground4: '#E2E8F0',
  colorNeutralBackground5: '#CBD5E1',
  colorNeutralBackground6: '#94A3B8',
  /* Strokes */
  colorNeutralStroke1: '#E2E8F0',
  colorNeutralStroke2: '#F1F5F9',
  colorNeutralStroke1Hover: '#CBD5E1',
  /* Typography */
  colorNeutralForeground1: '#1E293B',
  colorNeutralForeground2: '#64748B',
  colorNeutralForeground3: '#94A3B8',
  /* Brand accents */
  colorBrandForeground1: '#0D9488',
  colorBrandForeground2: '#0F766E',
  /* Radii */
  borderRadiusSmall: '6px',
  borderRadiusMedium: '8px',
  borderRadiusLarge: '12px',
  borderRadiusXLarge: '16px',
};

/**
 * Fluent dark theme — Layered dark slate tones.
 * Background: #0F172A, Panels: #1E293B, Strokes: #334155.
 */
export const careFlowDarkTheme: Theme = {
  ...dark,
  /* Surfaces */
  colorNeutralBackground1: '#1E293B',
  colorNeutralBackground2: '#0F172A',
  colorNeutralBackground3: '#1E293B',
  colorNeutralBackground4: '#334155',
  colorNeutralBackground5: '#475569',
  colorNeutralBackground6: '#64748B',
  /* Strokes */
  colorNeutralStroke1: '#334155',
  colorNeutralStroke2: '#1E293B',
  colorNeutralStroke1Hover: '#475569',
  /* Typography */
  colorNeutralForeground1: '#F1F5F9',
  colorNeutralForeground2: '#CBD5E1',
  colorNeutralForeground3: '#94A3B8',
  /* Brand accents */
  colorBrandForeground1: '#2DD4BF',
  colorBrandForeground2: '#14B8A6',
  /* Radii */
  borderRadiusSmall: '6px',
  borderRadiusMedium: '8px',
  borderRadiusLarge: '12px',
  borderRadiusXLarge: '16px',
};
