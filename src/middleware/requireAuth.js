import jwt from 'jsonwebtoken';

export default function requireAuth(req, res, next) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    res.status(503).json({
      error: 'Account sign-in is not configured on this server.',
      code: 'AUTH_NOT_CONFIGURED'
    });
    return;
  }

  const token = req.cookies?.weathergpt_session;
  if (!token) {
    res.status(401).json({ error: 'Please sign in to continue.', code: 'SESSION_REQUIRED' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'SESSION_EXPIRED' });
      return;
    }
    next(error);
  }
}
