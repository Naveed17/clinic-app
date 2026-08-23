import type { JSX, ReactNode } from 'react';
import { FluentProvider } from '@fluentui/react-components';
import { useColorMode } from '@/app/colorMode';
import { GlobalStyles } from './globalStyles';
import { careFlowDarkTheme, careFlowLightTheme } from './fluent-theme';
import { MaterialsProvider } from './MaterialsContext';

export interface ThemeRegistryProps {
  children: ReactNode;
}

/**
 * Fluent UI React v9 is the primary design system (Fluent 2).
 * @see https://fluent2.microsoft.design/get-started/develop
 */
export function ThemeRegistry({ children }: ThemeRegistryProps): JSX.Element {
  const { mode } = useColorMode();
  const fluentTheme = mode === 'dark' ? careFlowDarkTheme : careFlowLightTheme;

  return (
    <FluentProvider
      theme={fluentTheme}
      style={{ minHeight: '100%', backgroundColor: 'transparent' }}
    >
      <GlobalStyles />
      <MaterialsProvider>{children}</MaterialsProvider>
    </FluentProvider>
  );
}
