import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import authRoutes from '../../src/routes/authRoutes.js';

const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN || '*';

app.use(cors({
  origin: clientOrigin,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(() => console.error('MongoDB connection failed'));
}

app.use((error, req, res, next) => {
  console.error('Request failed:', error.message);
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(500).json({ error: 'An unexpected server error occurred.', code: 'SERVER_ERROR' });
});

export default function handler(req, res) {
  return app(req, res);
}
