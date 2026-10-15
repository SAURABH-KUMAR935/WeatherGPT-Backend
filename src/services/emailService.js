import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);

function isEmailConfigured() {
  return Boolean(
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    Number.isInteger(SMTP_PORT) &&
    SMTP_PORT > 0 &&
    SMTP_PORT <= 65535
  );
}

export async function sendRegistrationOtp(email, otp) {
  if (!isEmailConfigured()) {
    const error = new Error('Email delivery is not configured.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Your WeatherGPT verification code',
    text: `Your WeatherGPT email verification code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#29362a"><h2>Verify your WeatherGPT account</h2><p>Enter this four-digit code to finish creating your account:</p><p style="font-size:32px;font-weight:700;letter-spacing:10px;padding:12px 0">${otp}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p></div>`
  });
}
