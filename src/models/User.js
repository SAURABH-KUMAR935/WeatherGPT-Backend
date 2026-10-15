import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 60
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    maxlength: 254
  },
  emailVerified: {
    type: Boolean,
    default: true
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  }
}, {
  timestamps: true
});

export default mongoose.model('User', userSchema);
