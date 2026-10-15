import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { randomInt } from 'node:crypto';
import RegistrationOtp from '../models/RegistrationOtp.js';
import User from '../models/User.js';
import { sendRegistrationOtp } from '../services/emailService.js';

const COOKIE_NAME = 'weathergpt_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const OTP_DURATION_MS = 10 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function databaseUnavailable(res) {
  if (mongoose.connection.readyState === 1) return false;
  res.status(503).json({
    error: 'Account storage is temporarily unavailable. Please try again later.',
    code: 'DATABASE_UNAVAILABLE'
  });
  return true;
}

function authConfigurationUnavailable(res) {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) return false;
  res.status(503).json({
    error: 'Account sign-in is not configured on this server.',
    code: 'AUTH_NOT_CONFIGURED'
  });
  return true;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

function setSessionCookie(res, userId) {
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS
  });
}

export async function requestRegistrationOtp(req, res, next) {
  if (authConfigurationUnavailable(res)) return;
  if (databaseUnavailable(res)) return;

  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (name.length < 2 || name.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 || password.length < 10 || password.length > 128) {
    res.status(400).json({ error: 'Check your name, email, and password requirements.', code: 'INVALID_INPUT' });
    return;
  }

  try {
    if (await User.exists({ email })) {
      res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_IN_USE' });
      return;
    }

    const now = new Date();
    let pending = await RegistrationOtp.findOne({ email });
    if (pending && pending.sentAt.getTime() + OTP_RESEND_DELAY_MS > now.getTime()) {
      res.status(429).json({
        error: 'Please wait before requesting another verification code.',
        code: 'OTP_RESEND_WAIT'
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const otp = String(randomInt(0, 10000)).padStart(4, '0');
    const otpHash = await bcrypt.hash(otp, 10);
    if (!pending) {
      pending = new RegistrationOtp({
        name,
        email,
        passwordHash,
        otpHash,
        attempts: 0,
        sentAt: now,
        expiresAt: new Date(now.getTime() + OTP_DURATION_MS)
      });
    } else {
      pending.name = name;
      pending.passwordHash = passwordHash;
      pending.otpHash = otpHash;
      pending.attempts = 0;
      pending.sentAt = now;
      pending.expiresAt = new Date(now.getTime() + OTP_DURATION_MS);
    }
    await pending.save();

    try {
      await sendRegistrationOtp(email, otp);
    } catch (mailError) {
      await RegistrationOtp.deleteOne({ _id: pending._id });
      if (mailError.code === 'EMAIL_NOT_CONFIGURED') {
        res.status(503).json({
          error: 'Email delivery is not configured.',
          code: 'EMAIL_NOT_CONFIGURED'
        });
        return;
      }
      console.error('Registration verification email could not be sent:', mailError.message);
      res.status(502).json({
        error: 'Could not send the verification email. Please try again later.',
        code: 'EMAIL_DELIVERY_FAILED'
      });
      return;
    }

    res.status(200).json({ code: 'OTP_SENT', expiresInSeconds: OTP_DURATION_MS / 1000 });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409).json({ error: 'A verification request already exists. Please try again.', code: 'OTP_REQUEST_EXISTS' });
      return;
    }
    next(error);
  }
}

export async function verifyRegistrationOtp(req, res, next) {
  if (authConfigurationUnavailable(res)) return;
  if (databaseUnavailable(res)) return;

  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4}$/.test(otp)) {
    res.status(400).json({ error: 'Enter the email and four-digit verification code.', code: 'INVALID_OTP_INPUT' });
    return;
  }

  try {
    const pending = await RegistrationOtp.findOne({ email });
    if (!pending || pending.expiresAt.getTime() <= Date.now()) {
      if (pending) await RegistrationOtp.deleteOne({ _id: pending._id });
      res.status(400).json({ error: 'The verification code expired. Request a new code.', code: 'OTP_EXPIRED' });
      return;
    }

    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      await RegistrationOtp.deleteOne({ _id: pending._id });
      res.status(429).json({ error: 'Too many incorrect codes. Request a new code.', code: 'OTP_TOO_MANY_ATTEMPTS' });
      return;
    }

    if (!await bcrypt.compare(otp, pending.otpHash)) {
      pending.attempts += 1;
      if (pending.attempts >= OTP_MAX_ATTEMPTS) {
        await RegistrationOtp.deleteOne({ _id: pending._id });
        res.status(429).json({ error: 'Too many incorrect codes. Request a new code.', code: 'OTP_TOO_MANY_ATTEMPTS' });
        return;
      }
      await pending.save();
      res.status(400).json({ error: 'The verification code is incorrect.', code: 'OTP_INVALID' });
      return;
    }

    const user = await User.create({
      name: pending.name,
      email: pending.email,
      passwordHash: pending.passwordHash,
      emailVerified: true
    });
    await RegistrationOtp.deleteOne({ _id: pending._id });
    setSessionCookie(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      try {
        await RegistrationOtp.deleteOne({ email });
      } catch (cleanupError) {
        next(cleanupError);
        return;
      }
      res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_IN_USE' });
      return;
    }
    next(error);
  }
}

export async function login(req, res, next) {
  if (authConfigurationUnavailable(res)) return;
  if (databaseUnavailable(res)) return;

  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password || password.length > 128) {
    res.status(400).json({ error: 'Enter your email and password.', code: 'INVALID_INPUT' });
    return;
  }

  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    const validPassword = user && await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Email or password is incorrect.', code: 'INVALID_CREDENTIALS' });
      return;
    }
    setSessionCookie(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentUser(req, res, next) {
  if (authConfigurationUnavailable(res)) return;
  if (databaseUnavailable(res)) return;
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', path: '/' });
      res.status(401).json({ error: 'Your account could not be found. Please sign in again.', code: 'SESSION_EXPIRED' });
      return;
    }
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export function logout(req, res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  res.status(204).end();
}
