import { ipcMain } from 'electron';
import { isLicenseModuleEnabled } from '../license/license.ipc';
import { getSearchScope } from '../../shared/searchAccess';
import { globalSearch } from './search.service';

function licenseModulesForSearch(): Record<string, boolean> {
  return {
    billing: isLicenseModuleEnabled('billing'),
    labDashboard: isLicenseModuleEnabled('labDashboard'),
  };
}

export function registerSearchIpc(): void {
  ipcMain.handle('search:global', (_e, query: string, role?: string) =>
    globalSearch(String(query || ''), getSearchScope(role, licenseModulesForSearch())),
  );
}
