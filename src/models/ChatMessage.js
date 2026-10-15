import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  channel: {
    type: String,
    enum: ['weather', 'farmer'],
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 20000
  }
}, {
  timestamps: true
});

chatMessageSchema.index({ userId: 1, channel: 1, createdAt: -1 });

export default mongoose.model('ChatMessage', chatMessageSchema);
