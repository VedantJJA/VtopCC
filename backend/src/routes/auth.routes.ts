import { Router } from 'express';
import { checkSession, initLogin, loginAttempt, autoLogin, logout, getDevCredentials } from '../controllers/auth.controller';

const router = Router();

router.post('/check-session', checkSession);
router.post('/start-login', initLogin);
router.post('/login-attempt', loginAttempt);
router.post('/auto-login', autoLogin);
router.post('/logout', logout);
router.post('/dev-creds', getDevCredentials);

export default router;
