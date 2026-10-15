import { Router } from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import {
  getCurrentUser,
  login,
  logout,
  requestRegistrationOtp,
  verifyRegistrationOtp
} from '../controllers/authController.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again later.', code: 'TOO_MANY_REQUESTS' }
});

router.use(cookieParser());
router.post('/register', authLimiter, requestRegistrationOtp);
router.post('/register/verify-otp', authLimiter, verifyRegistrationOtp);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, getCurrentUser);

export default router;
