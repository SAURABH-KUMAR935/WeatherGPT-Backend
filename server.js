import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import authRoutes from './src/routes/authRoutes.js';
import chatRoutes from './src/routes/chatRoutes.js';
import chatHistoryRoutes from './src/routes/chatHistoryRoutes.js';
import farmerGPTRoutes from './src/routes/farmerGPTRoutes.js';
import weatherRoutes from './src/routes/weatherRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

app.use(cors({
  origin: clientOrigin,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/chat-history', chatHistoryRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/farmer-gpt', farmerGPTRoutes);

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required for account registration and login.');
} else {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(() => console.error('MongoDB connection failed. Check MONGODB_URI and database access.'));
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be configured with a random value of at least 32 characters.');
}

app.use((error, req, res, next) => {
  console.error('Request failed:', error.message);
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(500).json({ error: 'An unexpected server error occurred.', code: 'SERVER_ERROR' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
