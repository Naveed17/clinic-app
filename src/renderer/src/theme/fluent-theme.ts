import {
  type BrandVariants,
  type Theme,
  createDarkTheme,
  createLightTheme,
} from '@fluentui/react-components';

/**
 * CareFlow brand ramp for Fluent UI React v9.
 * @see https://fluent2.microsoft.design/get-started/develop
 */
const careFlowBrand: BrandVariants = {
  10: '#052e16',
  20: '#0a3d1c',
  30: '#14532d',
  40: '#166534',
  50: '#15803d',
  60: '#16a34a',
  70: '#22c55e',
  80: '#4ade80',
  90: '#86efac',
  100: '#bbf7d0',
  110: '#dcfce7',
  120: '#e8f9ee',
  130: '#f0fdf4',
  140: '#f5fef8',
  150: '#fafffb',
  160: '#ffffff',
};

const light = createLightTheme(careFlowBrand);
const dark = createDarkTheme(careFlowBrand);

/** Fluent light theme — CareFlow green primary. */
export const careFlowLightTheme: Theme = {
  ...light,
  colorBrandForeground1: careFlowBrand[80],
  colorBrandForeground2: careFlowBrand[70],
};

/** Fluent dark theme — brighter brand for contrast on dark surfaces. */
export const careFlowDarkTheme: Theme = {
  ...dark,
  colorBrandForeground1: careFlowBrand[70],
  colorBrandForeground2: careFlowBrand[80],
};
