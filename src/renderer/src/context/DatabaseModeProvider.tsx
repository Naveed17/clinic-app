/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export type DatabaseMode = 'local' | 'online';

export interface DatabaseModeContextValue {
  ready: boolean;
  databaseMode: DatabaseMode;
  isOnline: boolean;
  clinicalApiUrl: string;
  schemaId: string;
  refresh: () => Promise<void>;
}

const DatabaseModeContext = createContext<DatabaseModeContextValue | null>(null);

export function DatabaseModeProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [ready, setReady] = useState(false);
  const [databaseMode, setDatabaseMode] = useState<DatabaseMode>('local');
  const [clinicalApiUrl, setClinicalApiUrl] = useState('');
  const [schemaId, setSchemaId] = useState('');

  const refresh = useCallback(async () => {
    try {
      // Sync license → settings/cache first (also refreshes onlineDatabase flag)
      await window.clinic?.license?.modules?.().catch(() => null);
      const [meta, s] = await Promise.all([
        window.clinic?.license?.databaseMode?.().catch(() => null),
        window.clinic?.settings.get().catch(() => null),
      ]);
      const mode: DatabaseMode =
        meta?.databaseMode === 'online' || s?.databaseMode === 'online' ? 'online' : 'local';
      setDatabaseMode(mode);
      setClinicalApiUrl(meta?.clinicalApiUrl || s?.clinicalApiUrl || '');
      setSchemaId(meta?.schemaId || s?.schemaId || '');
    } catch {
      setDatabaseMode('local');
      setClinicalApiUrl('');
      setSchemaId('');
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<DatabaseModeContextValue>(
    () => ({
      ready,
      databaseMode,
      isOnline: databaseMode === 'online',
      clinicalApiUrl,
      schemaId,
      refresh,
    }),
    [ready, databaseMode, clinicalApiUrl, schemaId, refresh],
  );

  return (
    <DatabaseModeContext.Provider value={value}>{children}</DatabaseModeContext.Provider>
  );
}

export function useDatabaseMode(): DatabaseModeContextValue {
  const ctx = useContext(DatabaseModeContext);
  if (!ctx) {
    throw new Error('useDatabaseMode must be used within DatabaseModeProvider.');
  }
  return ctx;
}
