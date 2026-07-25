import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { startLogin, performVtopLogin, VtopState } from '../services/vtop.service';
import { trackUser } from './admin.controller';

const JWT_SECRET = process.env.JWT_SECRET || 'vtopc_default_jwt_secret_key_change_this_in_prod';
const CREDS_COOKIE = 'vtop_creds';
const STATE_COOKIE = 'vtop_state';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const
};

// --- JWT Helpers ---

function encryptCredentials(username: string, password: string): string {
  return jwt.sign({ u: username, p: password }, JWT_SECRET, { expiresIn: '30d' });
}

function decryptCredentials(token: string): { u: string; p: string } {
  return jwt.verify(token, JWT_SECRET) as { u: string; p: string };
}

function encryptState(state: VtopState): string {
  // 1h expiry — VTOP sessions rarely last longer. Re-auth flow handles expiry.
  return jwt.sign({ s: state }, JWT_SECRET, { expiresIn: '1h' });
}

function decryptState(token: string): VtopState {
  const decoded = jwt.verify(token, JWT_SECRET) as { s: VtopState };
  return decoded.s;
}

function setStateCookie(res: Response, state: VtopState): void {
  res.cookie(STATE_COOKIE, encryptState(state), COOKIE_OPTS);
}

// --- Controllers ---

export const checkSession = async (req: Request, res: Response) => {
  const stateToken = req.cookies[STATE_COOKIE];
  if (!stateToken) {
    return res.json({ status: 'failure' });
  }

  try {
    const state = decryptState(stateToken);
    if (state.authorizedId) {
      return res.json({
        status: 'success',
        message: `Welcome back, ${state.authorizedId}!`,
        username: state.authorizedId
      });
    }
  } catch (_e) {
    // Token expired or invalid
  }

  return res.json({ status: 'failure' });
};

export const initLogin = async (_req: Request, res: Response) => {
  console.log('\n[DEBUG] Initiating new login session...');
  try {
    const hasSavedCreds = !!_req.cookies[CREDS_COOKIE];
    const { state, captchaType, captchaImageData } = await startLogin();

    // Set state cookie (contains serialized jar + csrf)
    setStateCookie(res, state);

    return res.json({
      status: 'captcha_ready',
      captcha_type: captchaType,
      captcha_image_data: captchaImageData,
      has_saved_creds: hasSavedCreds
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'failure',
      message: error.message || 'Failed to initialize login'
    });
  }
};

export const loginAttempt = async (req: Request, res: Response) => {
  const { username, password, captcha, gResponse } = req.body;
  const stateToken = req.cookies[STATE_COOKIE];

  if (!stateToken) {
    return res.status(400).json({ status: 'failure', message: 'Session expired.' });
  }

  let state: VtopState;
  try {
    state = decryptState(stateToken);
  } catch (_e) {
    return res.status(400).json({ status: 'failure', message: 'Session expired.' });
  }

  const result = await performVtopLogin(state, username, password, captcha, gResponse);

  if (result.success && result.updatedState) {
    // Set updated state cookie (with authorizedId + fresh jar)
    setStateCookie(res, result.updatedState);

    // Track unique user by roll number
    if (result.authorizedId) trackUser(result.authorizedId);

    // Store encrypted credentials for auto-login (30 days)
    res.cookie(CREDS_COOKIE, encryptCredentials(username, password), {
      ...COOKIE_OPTS,
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      status: 'success',
      message: `Welcome, ${result.authorizedId}!`
    });
  } else {
    return res.json({
      status: result.code,
      message: result.message
    });
  }
};

export const autoLogin = async (req: Request, res: Response) => {
  const { captcha, gResponse } = req.body;
  const stateToken = req.cookies[STATE_COOKIE];
  const credsToken = req.cookies[CREDS_COOKIE];

  if (!stateToken) {
    return res.status(400).json({ status: 'failure', message: 'Session expired.' });
  }

  if (!credsToken) {
    return res.status(400).json({ status: 'failure', message: 'No saved credentials.' });
  }

  let state: VtopState;
  try {
    state = decryptState(stateToken);
  } catch (_e) {
    return res.status(400).json({ status: 'failure', message: 'Session expired.' });
  }

  try {
    const creds = decryptCredentials(credsToken);
    const { u: username, p: password } = creds;

    const result = await performVtopLogin(state, username, password, captcha, gResponse);

    if (result.success && result.updatedState) {
      setStateCookie(res, result.updatedState);

      // Track unique user by roll number
      if (result.authorizedId) trackUser(result.authorizedId);

      return res.json({
        status: 'success',
        message: `Welcome back, ${result.authorizedId}!`
      });
    } else if (result.code === 'invalid_credentials') {
      res.clearCookie(CREDS_COOKIE);
      return res.json({
        status: result.code,
        message: result.message
      });
    } else {
      return res.json({
        status: result.code,
        message: result.message
      });
    }
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      res.clearCookie(CREDS_COOKIE);
      return res.status(400).json({ status: 'failure', message: 'Invalid credentials cookie.' });
    }
    return res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
  }
};

export const logout = async (_req: Request, res: Response) => {
  res.clearCookie(CREDS_COOKIE);
  res.clearCookie(STATE_COOKIE);
  return res.json({ status: 'success' });
};

export const getDevCredentials = async (_req: Request, res: Response) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../../../.idpass');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      let username = '';
      let password = '';
      for (const line of lines) {
        if (line.startsWith('ID:')) {
          username = line.substring(3).trim();
        } else if (line.startsWith('PASS:')) {
          password = line.substring(5).trim();
        }
      }
      return res.json({ status: 'success', username, password });
    }
    return res.status(404).json({ status: 'error', message: 'No dev credentials found.' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};
