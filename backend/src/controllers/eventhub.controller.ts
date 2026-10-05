import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { 
  loginEventHub, 
  parseEventCards, 
  fetchEventPreview, 
  fetchEventHubProfile 
} from '../services/eventhub.service';

const JWT_SECRET = process.env.JWT_SECRET || 'vtopc_default_jwt_secret_key_change_this_in_prod';
const CREDS_COOKIE = 'vtop_creds';

function resolveCredentials(req: Request): { username?: string; password?: string } {
  if (req.body.username && req.body.password) {
    return { username: req.body.username.trim(), password: req.body.password };
  }

  const credsToken = req.cookies[CREDS_COOKIE];
  if (credsToken) {
    try {
      const decoded = jwt.verify(credsToken, JWT_SECRET) as { u: string; p: string };
      if (decoded.u && decoded.p) {
        return { username: decoded.u, password: decoded.p };
      }
    } catch (_e) {
      // Invalid or expired token
    }
  }

  return {};
}

export const getEvents = async (req: Request, res: Response) => {
  const { username, password } = resolveCredentials(req);
  if (!username || !password) {
    return res.status(200).json({
      status: 'auth_required',
      message: 'EventHub requires VTOP login credentials.'
    });
  }

  try {
    const { html } = await loginEventHub(username, password);
    const parsed = parseEventCards(html);

    return res.json({
      status: 'success',
      events: parsed.events,
      categories: parsed.categories,
      user: username
    });
  } catch (error: any) {
    console.error('getEvents failed:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch EventHub events.'
    });
  }
};

export const getPreview = async (req: Request, res: Response) => {
  const { eid } = req.body;
  if (!eid) {
    return res.status(400).json({ status: 'error', message: 'Event ID (eid) is required.' });
  }

  const { username, password } = resolveCredentials(req);
  if (!username || !password) {
    return res.status(200).json({
      status: 'auth_required',
      message: 'EventHub requires VTOP login credentials.'
    });
  }

  try {
    const { client } = await loginEventHub(username, password);
    const preview = await fetchEventPreview(client, eid);

    if (!preview) {
      return res.status(404).json({ status: 'error', message: 'Event preview not found.' });
    }

    return res.json({
      status: 'success',
      preview
    });
  } catch (error: any) {
    console.error('getPreview failed:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch event preview.'
    });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  const { username, password } = resolveCredentials(req);
  if (!username || !password) {
    return res.status(200).json({
      status: 'auth_required',
      message: 'EventHub requires VTOP login credentials.'
    });
  }

  try {
    const { client } = await loginEventHub(username, password);
    const profile = await fetchEventHubProfile(client);

    return res.json({
      status: 'success',
      profile
    });
  } catch (error: any) {
    console.error('getProfile failed:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch EventHub profile.'
    });
  }
};
