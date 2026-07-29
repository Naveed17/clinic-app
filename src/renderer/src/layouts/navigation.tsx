import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import type { ReactNode } from 'react';
import type { UserRole } from '@/features/auth/AuthContext';
import type { AppRoute } from '@/app/access';
import { canAccess, isModuleEnabled } from '@/app/access';
import type { LicenseModules } from '@/features/auth/LicenseModulesContext';

export interface NavigationItem {
  label: string;
  path: AppRoute;
  icon: ReactNode;
}

const ALL_NAV_ITEMS: NavigationItem[] = [
  { label: 'Dashboard',    path: '/dashboard',    icon: <DashboardOutlinedIcon /> },
  { label: 'Patients',     path: '/patients',     icon: <GroupOutlinedIcon /> },
  { label: 'Appointments', path: '/appointments', icon: <CalendarMonthOutlinedIcon /> },
  { label: 'Tokens',       path: '/tokens',       icon: <ConfirmationNumberOutlinedIcon /> },
  { label: 'Billing',      path: '/billing',      icon: <PaymentsOutlinedIcon /> },
  { label: 'Lab',          path: '/lab',          icon: <BiotechOutlinedIcon /> },
  { label: 'Statistics',   path: '/statistics',   icon: <BarChartOutlinedIcon /> },
  { label: 'Doctors',      path: '/doctors',      icon: <LocalHospitalOutlinedIcon /> },
  { label: 'Schedule',     path: '/schedule',     icon: <EventAvailableOutlinedIcon /> },
  { label: 'Users',        path: '/users',        icon: <ManageAccountsOutlinedIcon /> },
];

export function getNavItems(role: UserRole, modules: LicenseModules | undefined): NavigationItem[] {
  return ALL_NAV_ITEMS.filter(
    (item) => canAccess(role, item.path) && isModuleEnabled(modules, item.path),
  );
}

// kept for non-role contexts (topbar indicator count etc.)
export const navigationItems = ALL_NAV_ITEMS;
