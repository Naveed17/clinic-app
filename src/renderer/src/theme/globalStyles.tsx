import type { JSX } from 'react';
import { useEffect } from 'react';

const CSS = `
*, *::before, *::after { box-sizing: border-box; }
html { width: 100%; height: 100%; -webkit-overflow-scrolling: touch; }
body, #root { width: 100%; height: 100%; margin: 0; }
html[data-mica="on"], html[data-mica="on"] body, html[data-mica="on"] #root {
  background-color: transparent !important;
  background: transparent !important;
}
html[data-mica="on"][data-window-focused="off"],
html[data-mica="on"][data-window-focused="off"] body,
html[data-mica="on"][data-window-focused="off"] #root {
  background-color: var(--cf-mica-fallback) !important;
  background: var(--cf-mica-fallback) !important;
}
html[data-acrylic="on"] [class*="fui-MenuPopover"],
html[data-acrylic="on"] [class*="fui-PopoverSurface"],
html[data-acrylic="on"] [class*="fui-Listbox"] {
  background-color: var(--cf-acrylic-fill) !important;
  backdrop-filter: var(--cf-acrylic-blur);
  -webkit-backdrop-filter: var(--cf-acrylic-blur);
}
.fui-Dialog__backdrop,
[class*="fui-Dialog"] [class*="backdrop"] {
  background-color: var(--cf-smoke, rgba(0, 0, 0, 0.32)) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
input[type=number] { -moz-appearance: textfield; }
input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button {
  margin: 0;
  -webkit-appearance: none;
}
a { color: inherit; }
`;

/**
 * Materials CSS — Mica base, Acrylic flyouts, Smoke modals.
 * @see https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/materials
 */
export function GlobalStyles(): JSX.Element {
  useEffect(() => {
    const id = 'careflow-global-styles';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = CSS;
    return () => {
      el?.remove();
    };
  }, []);
  return <></>;
}
