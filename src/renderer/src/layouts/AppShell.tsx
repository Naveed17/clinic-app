import { Outlet } from 'react-router-dom';
import { Win11DesktopShell } from './Win11DesktopShell';

export function AppShell(): React.JSX.Element {
  return (
    <Win11DesktopShell>
      <Outlet />
    </Win11DesktopShell>
  );
}
