import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { sessionService } from '../services/session.service';
import { startLogin, performVtopLogin } from '../services/vtop.service';

const JWT_SECRET = process.env.JWT_SECRET || 'vtopc_default_jwt_secret_key_change_this_in_prod';
const COOKIE_NAME = 'vtop_creds';

// Helper to encrypt credentials
function encryptCredentials(username: string, password: string): string {
  return jwt.sign({ u: username, p: password }, JWT_SECRET, { expiresIn: '30d' });
}

// Helper to decrypt credentials
function decryptCredentials(token: string): { u: string; p: string } {
  return jwt.verify(token, JWT_SECRET) as { u: string; p: string };
}

export const checkSession = async (req: Request, res: Response) => {
  const session_id = req.cookies.vtop_session_id;
  if (session_id) {
    const session = sessionService.getSession(session_id);
    if (session) {
      const userDisplay = session.authorizedId || session.username || 'User';
      return res.json({
        status: 'success',
        message: `Welcome back, ${userDisplay}!`,
        session_id,
        username: userDisplay
      });
    }
  }
  return res.json({ status: 'failure' });
};

export const initLogin = async (req: Request, res: Response) => {
  console.log('\n[DEBUG] Initiating new login session...');
  try {
    const hasSavedCreds = !!req.cookies[COOKIE_NAME];
    const { sessionId, captchaType, captchaImageData } = await startLogin();

    // 1. Set the cookie for backend session persistence
    res.cookie('vtop_session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // 2. MUST return session_id in JSON so React state doesn't break
    return res.json({
      status: 'captcha_ready',
      session_id: sessionId,
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
  const session_id = req.cookies.vtop_session_id;

  if (!session_id || !sessionService.getSession(session_id)) {
    return res.status(400).json({ status: 'failure', message: 'Session expired.' });
  }

  const result = await performVtopLogin(session_id, username, password, captcha, gResponse);

  if (result.success) {
    // Encrypt and store credentials in HttpOnly Cookie (30 Days)
    const token = encryptCredentials(username, password);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 Days
    });

    return res.json({
      status: 'success',
      message: `Welcome, ${result.authorizedId}!`,
      session_id
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
  const session_id = req.cookies.vtop_session_id;

  if (!session_id || !sessionService.getSession(session_id)) {
    return res.status(400).json({ status: 'failure', message: 'Session expired.' });
  }

  const cookieToken = req.cookies[COOKIE_NAME];
  if (!cookieToken) {
    return res.status(400).json({ status: 'failure', message: 'No saved credentials.' });
  }

  try {
    const creds = decryptCredentials(cookieToken);
    const { u: username, p: password } = creds;

    const result = await performVtopLogin(session_id, username, password, captcha, gResponse);

    if (result.success) {
      return res.json({
        status: 'success',
        message: `Welcome back, ${result.authorizedId}!`,
        session_id
      });
    } else if (result.code === 'invalid_credentials') {
      // Clear cookie if saved credentials are wrong
      res.clearCookie(COOKIE_NAME);
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
      res.clearCookie(COOKIE_NAME);
      return res.status(400).json({ status: 'failure', message: 'Invalid credentials cookie.' });
    }
    return res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  const session_id = req.cookies.vtop_session_id;
  if (session_id) {
    sessionService.deleteSession(session_id);
  }

  res.clearCookie(COOKIE_NAME);
  res.clearCookie('vtop_session_id');
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
