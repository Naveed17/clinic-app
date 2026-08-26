import { Outlet } from 'react-router-dom';
import { Windows12Shell } from './Windows12Shell';

export function AppShell(): React.JSX.Element {
  return (
    <Windows12Shell>
      <Outlet />
    </Windows12Shell>
  );
}
