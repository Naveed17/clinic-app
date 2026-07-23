import { createContext, useContext } from 'react';

export type ColorMode = 'light' | 'dark';

interface ColorModeContextValue {
  mode: ColorMode;
  toggleColorMode: () => void;
}

export const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined);

export function useColorMode(): ColorModeContextValue {
  const context = useContext(ColorModeContext);

  if (!context) {
    throw new Error('useColorMode must be used within AppProviders.');
  }

  return context;
}
