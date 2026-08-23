/**
 * Fluent 2 materials — design philosophy mapping for CareFlow.
 * @see https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/materials
 * @see https://fluent2.microsoft.design/material
 *
 * Mica   → Electron window base (wallpaper tint, focus-aware)
 * Acrylic → transient only (Menu / Popover / flyouts)
 * Smoke  → modal dimming (always translucent black)
 * Solid  → permanent content / commanding layers
 */

export type ColorScheme = 'light' | 'dark';

export const materialTokens = {
  light: {
    micaFallback: '#f3f3f3',
    layerFill: 'rgba(255, 255, 255, 0.85)',
    commandingFill: 'rgba(255, 255, 255, 0.78)',
    acrylicFill: 'rgba(252, 252, 252, 0.72)',
    acrylicBlur: 'blur(30px) saturate(125%)',
    smoke: 'rgba(0, 0, 0, 0.32)',
  },
  dark: {
    micaFallback: '#202020',
    layerFill: 'rgba(32, 32, 32, 0.85)',
    commandingFill: 'rgba(28, 28, 28, 0.78)',
    acrylicFill: 'rgba(44, 44, 44, 0.72)',
    acrylicBlur: 'blur(30px) saturate(125%)',
    smoke: 'rgba(0, 0, 0, 0.40)',
  },
} as const;

export function applyMaterialCssVars(mode: ColorScheme): void {
  const m = materialTokens[mode];
  const root = document.documentElement;
  root.style.setProperty('--cf-mica-fallback', m.micaFallback);
  root.style.setProperty('--cf-layer-fill', m.layerFill);
  root.style.setProperty('--cf-commanding-fill', m.commandingFill);
  root.style.setProperty('--cf-acrylic-fill', m.acrylicFill);
  root.style.setProperty('--cf-acrylic-blur', m.acrylicBlur);
  root.style.setProperty('--cf-smoke', m.smoke);
}
