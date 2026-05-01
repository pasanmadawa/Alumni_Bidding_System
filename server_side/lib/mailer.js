'use strict';

const nodemailer = require('nodemailer');

let cachedMailer;

function createTransporter() {
  if (cachedMailer) {
    return cachedMailer;
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);

  if (smtpHost && smtpUser && smtpPass) {
    cachedMailer = {
      simulated: false,
      transporter: nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      })
    };
    return cachedMailer;
  }

  if (smtpUser && smtpPass) {
    cachedMailer = {
      simulated: false,
      transporter: nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      })
    };
    return cachedMailer;
  }

  cachedMailer = {
    simulated: true,
    transporter: nodemailer.createTransport({
      jsonTransport: true
    })
  };

  return cachedMailer;
}

async function sendMail(options) {
  const mailer = createTransporter();
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@alumni-bidding.local';
  const info = await mailer.transporter.sendMail({
    from: from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html
  });

  if (mailer.simulated) {
    console.log('Simulated email:', info.message.toString());
  }

  return {
    simulated: mailer.simulated
  };
}

async function sendVerificationEmail(options) {
  const verifyUrl = options.baseUrl + '/auth/verify-email?token=' + encodeURIComponent(options.token);

  return sendMail({
    to: options.to,
    subject: 'Verify your alumni account',
    text:
      'Your Alumni Club verification OTP is: ' + options.token + '\n\n' +
      'This code expires in 24 hours.\n\n' +
      'You can also verify your email by opening this link: ' + verifyUrl,
    html:
      '<p>Your Alumni Club verification OTP is:</p>' +
      '<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">' + options.token + '</p>' +
      '<p>This code expires in 24 hours.</p>' +
      '<p>You can also verify your email by opening this link:</p>' +
      '<p><a href="' + verifyUrl + '">' + verifyUrl + '</a></p>'
  });
}

async function sendLoginOtpEmail(options) {
  return sendMail({
    to: options.to,
    subject: 'Your Alumni Club login OTP',
    text:
      'Your Alumni Club login OTP is: ' + options.otp + '\n\n' +
      'This code expires in 10 minutes.',
    html:
      '<p>Your Alumni Club login OTP is:</p>' +
      '<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">' + options.otp + '</p>' +
      '<p>This code expires in 10 minutes.</p>'
  });
}

async function sendPasswordResetEmail(options) {
  return sendMail({
    to: options.to,
    subject: 'Reset your alumni account password',
    text:
      'Your Alumni Club password reset OTP is: ' + options.token + '\n\n' +
      'This code expires in 1 hour.',
    html:
      '<p>Your Alumni Club password reset OTP is:</p>' +
      '<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">' + options.token + '</p>' +
      '<p>This code expires in 1 hour.</p>'
  });
}

module.exports = {
  sendMail: sendMail,
  sendLoginOtpEmail: sendLoginOtpEmail,
  sendPasswordResetEmail: sendPasswordResetEmail,
  sendVerificationEmail: sendVerificationEmail
};
