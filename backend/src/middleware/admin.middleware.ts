import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vtopc_default_jwt_secret_key_change_this_in_prod';

function getAdminRollNumbers(): string[] {
  const raw = process.env.ADMIN_ROLL_NUMBERS || '';
  return raw.split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
}

/**
 * Middleware that checks whether the requesting user's roll number
 * (from the vtop_state JWT cookie) is in the ADMIN_ROLL_NUMBERS env var.
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const stateToken = req.cookies['vtop_state'];
  if (!stateToken) {
    res.status(403).json({ status: 'error', message: 'Not authenticated' });
    return;
  }

  try {
    const decoded = jwt.verify(stateToken, JWT_SECRET) as any;
    const rollNumber = (decoded?.s?.authorizedId || '').toUpperCase();
    const adminList = getAdminRollNumbers();

    if (!rollNumber || !adminList.includes(rollNumber)) {
      res.status(403).json({ status: 'error', message: 'Admin access denied' });
      return;
    }

    next();
  } catch (_e) {
    res.status(403).json({ status: 'error', message: 'Invalid or expired session' });
  }
};

/**
 * Check whether a given roll number is an admin without middleware blocking.
 */
export function isRollNumberAdmin(rollNumber: string): boolean {
  return getAdminRollNumbers().includes(rollNumber.toUpperCase());
}
