const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT) || 587,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || 'noreply@coworkspace.com',
            to,
            subject,
            html
        });
    } catch (err) {
        console.log('Email send failed (non-fatal):', err.message);
    }
};

module.exports = sendEmail;
