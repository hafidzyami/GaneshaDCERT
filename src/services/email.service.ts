import nodemailer from 'nodemailer';
import { env } from '../config/env';
import logger from '../config/logger';

// Configure transporter for Nodemailer
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false, // true for port 465, false for others
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

// Interface for email parameters
interface SendMagicLinkEmailParams {
  to: string;
  name: string;
  magicLink: string;
}

/**
 * Send email containing Magic Link to user
 */
export const sendMagicLinkEmail = async ({
  to,
  name,
  magicLink,
}: SendMagicLinkEmailParams): Promise<void> => {
  try {
    const mailOptions = {
      from: `"GaneshaDCERT" <${env.SMTP_USER}>`,
      to,
      subject: 'Your GaneshaDCERT Institution Account is Approved',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #4CAF50;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 20px;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <h2>Welcome, ${name}!</h2>
              <p>Your account has been approved by the administrator.</p>
              <p>Click the button below to log in to the GaneshaDCERT system:</p>
              <a href="${magicLink}" class="button">Login to GaneshaDCERT</a>
              <p><strong>Note:</strong></p>
              <ul>
                <li>This link is valid for 24 hours</li>
                <li>This link can only be used once</li>
                <li>Do not share this link with anyone</li>
              </ul>
              <p>If the button above does not work, copy and paste the following URL into your browser:</p>
              <p style="word-break: break-all; color: #666;">${magicLink}</p>
            </div>
            <div class="footer">
              <p>This email was sent automatically. Please do not reply to this email.</p>
              <p>&copy; 2025 GaneshaDCERT. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.success(`Magic link email sent to ${to}`);
  } catch (error) {
    logger.error('Failed to send magic link email', error);
    throw new Error('Failed to send magic link email');
  }
};

/**
 * Verify email configuration
 */
export const verifyEmailConfiguration = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    logger.success('Email configuration is valid');
    return true;
  } catch (error) {
    logger.error('Email configuration error', error);
    return false;
  }
};
