import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);
router.get('/dev-login', authController.devLogin);
router.post('/register', authController.register);
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authController.logout);

export default router;
