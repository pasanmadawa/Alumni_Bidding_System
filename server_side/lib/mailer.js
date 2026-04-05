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
      'Verify your email by opening this link: ' + verifyUrl + '\n\n' +
      'If you are testing with Postman, you can also call GET /auth/verify-email?token=' + options.token,
    html:
      '<p>Verify your email by opening this link:</p>' +
      '<p><a href="' + verifyUrl + '">' + verifyUrl + '</a></p>'
  });
}

async function sendPasswordResetEmail(options) {
  return sendMail({
    to: options.to,
    subject: 'Reset your alumni account password',
    text:
      'Use this reset token in POST /auth/reset-password:\n\n' + options.token + '\n\n' +
      'Example JSON body:\n' +
      '{ "token": "' + options.token + '", "newPassword": "NewPass123!" }',
    html:
      '<p>Use this reset token in <code>POST /auth/reset-password</code>:</p>' +
      '<p><strong>' + options.token + '</strong></p>'
  });
}

module.exports = {
  sendMail: sendMail,
  sendPasswordResetEmail: sendPasswordResetEmail,
  sendVerificationEmail: sendVerificationEmail
};
