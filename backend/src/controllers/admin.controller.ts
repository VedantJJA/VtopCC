import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { isRollNumberAdmin } from '../middleware/admin.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'vtopc_default_jwt_secret_key_change_this_in_prod';

// In-memory user tracker
const trackedUsers = new Set<string>();
const userLoginTimestamps = new Map<string, string>(); // rollNumber -> first login ISO timestamp

/**
 * Called by auth controller on successful login to track unique users.
 */
export function trackUser(rollNumber: string): void {
  const upper = rollNumber.toUpperCase();
  if (!trackedUsers.has(upper)) {
    trackedUsers.add(upper);
    userLoginTimestamps.set(upper, new Date().toISOString());
    console.log(`[UserTracker] New user registered: ${upper} (Total: ${trackedUsers.size})`);
  }
}

/**
 * GET /api/admin/user-count
 * Public endpoint — returns just the total count of unique users.
 */
export const getUserCount = (_req: Request, res: Response): void => {
  res.json({ count: trackedUsers.size });
};

/**
 * GET /api/admin/stats
 * Admin-only — returns full user list with timestamps.
 */
export const getAdminStats = (_req: Request, res: Response): void => {
  const users = Array.from(trackedUsers).map(rollNumber => ({
    rollNumber,
    firstSeen: userLoginTimestamps.get(rollNumber) || 'unknown'
  }));

  res.json({
    totalUsers: trackedUsers.size,
    users
  });
};

/**
 * GET /api/admin/check
 * Returns whether the current user (from vtop_state cookie) is an admin.
 */
export const checkAdmin = (req: Request, res: Response): void => {
  const stateToken = req.cookies['vtop_state'];
  if (!stateToken) {
    res.json({ isAdmin: false });
    return;
  }

  try {
    const decoded = jwt.verify(stateToken, JWT_SECRET) as any;
    const rollNumber = decoded?.s?.authorizedId || '';
    res.json({ isAdmin: isRollNumberAdmin(rollNumber) });
  } catch (_e) {
    res.json({ isAdmin: false });
  }
};
