import mongoose from 'mongoose';

const registrationOtpSchema = new mongoose.Schema({
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
  passwordHash: {
    type: String,
    required: true
  },
  otpHash: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    required: true,
    default: 0
  },
  sentAt: {
    type: Date,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('RegistrationOtp', registrationOtpSchema);
