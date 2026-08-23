import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { useColorMode } from '@/app/colorMode';
import { applyMaterialCssVars } from './material-tokens';

export type MaterialsOs = 'win11' | 'win10' | 'other';

export type MaterialsCapability = {
  mica: boolean;
  acrylic: boolean;
  os: MaterialsOs;
};

export type MaterialsContextValue = {
  capability: MaterialsCapability;
  windowFocused: boolean;
  reducedTransparency: boolean;
  micaActive: boolean;
  acrylicActive: boolean;
};

const defaultCapability: MaterialsCapability = {
  mica: false,
  acrylic: true,
  os: 'other',
};

const MaterialsContext = createContext<MaterialsContextValue>({
  capability: defaultCapability,
  windowFocused: true,
  reducedTransparency: false,
  micaActive: false,
  acrylicActive: true,
});

export function useMaterials(): MaterialsContextValue {
  return useContext(MaterialsContext);
}

function usePrefersReducedTransparency(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-transparency: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function MaterialsProvider({ children }: { children: ReactNode }): JSX.Element {
  const { mode } = useColorMode();
  const [capability, setCapability] = useState<MaterialsCapability>(defaultCapability);
  const [windowFocused, setWindowFocused] = useState(true);
  const reducedTransparency = usePrefersReducedTransparency();

  useEffect(() => {
    let cancelled = false;
    void window.clinic?.ui
      ?.getMaterials()
      .then((cap) => {
        if (!cancelled && cap) setCapability(cap);
      })
      .catch(() => undefined);

    const off = window.clinic?.ui?.onFocusChange?.((focused) => {
      setWindowFocused(focused);
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, []);

  useEffect(() => {
    applyMaterialCssVars(mode);
  }, [mode]);

  const micaActive = capability.mica && !reducedTransparency;
  const acrylicActive = capability.acrylic && !reducedTransparency;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mica = micaActive ? 'on' : 'off';
    root.dataset.windowFocused = windowFocused ? 'on' : 'off';
    root.dataset.acrylic = acrylicActive ? 'on' : 'off';
  }, [micaActive, windowFocused, acrylicActive]);

  const value = useMemo<MaterialsContextValue>(
    () => ({
      capability,
      windowFocused,
      reducedTransparency,
      micaActive,
      acrylicActive,
    }),
    [capability, windowFocused, reducedTransparency, micaActive, acrylicActive],
  );

  return <MaterialsContext.Provider value={value}>{children}</MaterialsContext.Provider>;
}
