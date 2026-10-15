import mongoose from 'mongoose';
import ChatMessage from '../models/ChatMessage.js';

const CHANNELS = new Set(['weather', 'farmer']);
const MAX_HISTORY_MESSAGES = 200;

function validChannel(channel) {
  return CHANNELS.has(channel);
}

export async function getChatHistory(req, res, next) {
  const { channel } = req.params;
  if (!validChannel(channel)) {
    res.status(400).json({ error: 'Chat type is invalid.', code: 'INVALID_CHAT_TYPE' });
    return;
  }
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: 'Chat history storage is unavailable.', code: 'DATABASE_UNAVAILABLE' });
    return;
  }

  try {
    const rows = await ChatMessage.find({ userId: req.userId, channel })
      .sort({ createdAt: -1, _id: -1 })
      .limit(MAX_HISTORY_MESSAGES)
      .lean();
    res.json({
      messages: rows.reverse().map(({ role, content }) => ({ role, content }))
    });
  } catch (error) {
    next(error);
  }
}

export async function saveChatMessages(req, res, next) {
  const { channel } = req.params;
  const messages = req.body?.messages;
  if (!validChannel(channel)) {
    res.status(400).json({ error: 'Chat type is invalid.', code: 'INVALID_CHAT_TYPE' });
    return;
  }
  if (
    !Array.isArray(messages) ||
    messages.length !== 2 ||
    messages[0]?.role !== 'user' ||
    messages[1]?.role !== 'assistant' ||
    messages.some(message =>
      typeof message.content !== 'string' ||
      message.content.trim().length === 0 ||
      message.content.length > 20000
    )
  ) {
    res.status(400).json({ error: 'The chat messages are invalid.', code: 'INVALID_MESSAGES' });
    return;
  }
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: 'Chat history storage is unavailable.', code: 'DATABASE_UNAVAILABLE' });
    return;
  }

  try {
    await ChatMessage.insertMany(messages.map(({ role, content }) => ({
      userId: req.userId,
      channel,
      role,
      content: content.trim()
    })), { ordered: true });
    res.status(201).json({ saved: messages.length });
  } catch (error) {
    next(error);
  }
}
