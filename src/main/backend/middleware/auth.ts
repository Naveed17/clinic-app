import type { Request, RequestHandler } from 'express';
import type { AppRole } from '../types';

function getRequestRole(req: Request): AppRole | undefined {
  const role = req.header('X-User-Role');
  if (!role) return undefined;
  if (role === 'admin' || role === 'doctor' || role === 'receptionist' || role === 'lab_technician') {
    return role;
  }
  return undefined;
}

export function requireRole(allowedRoles: AppRole[]): RequestHandler {
  return (req, res, next) => {
    const role = getRequestRole(req);
    if (!role) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(role)) {
      res.status(403).json({ message: 'You are not allowed to access this resource.' });
      return;
    }
    next();
  };
}
