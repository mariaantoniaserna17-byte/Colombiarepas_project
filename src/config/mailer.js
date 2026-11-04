const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  // Si se configuran credenciales SMTP reales en .env
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_USER !== 'test@ethereal.email') {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    return transporter;
  }

  // De lo contrario, crea una cuenta de prueba en Ethereal automáticamente
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log(`[Mailer] Cuenta de prueba Ethereal generada: ${testAccount.user}`);
    return transporter;
  } catch (err) {
    console.warn('[Mailer Warning] No se pudo crear cuenta de prueba Ethereal, usando transportador dummy');
    return nodemailer.createTransport({ jsonTransport: true });
  }
};

module.exports = { getTransporter };

