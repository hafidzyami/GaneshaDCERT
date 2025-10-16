import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Konfigurasi transporter untuk Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true untuk port 465, false untuk port lainnya
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Interface untuk parameter email
interface SendMagicLinkEmailParams {
  to: string;
  name: string;
  magicLink: string;
}

/**
 * Mengirim email berisi Magic Link ke pengguna
 */
export const sendMagicLinkEmail = async ({
  to,
  name,
  magicLink,
}: SendMagicLinkEmailParams): Promise<void> => {
  try {
    const mailOptions = {
      from: `"GaneshaDCERT" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Akun Anda Telah Disetujui - Magic Link Login',
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
              <h2>Selamat, ${name}!</h2>
              <p>Akun Anda telah disetujui oleh administrator.</p>
              <p>Klik tombol di bawah ini untuk login ke sistem GaneshaDCERT:</p>
              <a href="${magicLink}" class="button">Login ke GaneshaDCERT</a>
              <p><strong>Catatan:</strong></p>
              <ul>
                <li>Link ini berlaku selama 24 jam</li>
                <li>Link ini hanya dapat digunakan satu kali</li>
                <li>Jangan bagikan link ini ke siapapun</li>
              </ul>
              <p>Jika tombol di atas tidak berfungsi, salin dan tempel URL berikut ke browser Anda:</p>
              <p style="word-break: break-all; color: #666;">${magicLink}</p>
            </div>
            <div class="footer">
              <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
              <p>&copy; 2025 GaneshaDCERT. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Magic link email sent to ${to}`);
  } catch (error) {
    console.error('Error sending magic link email:', error);
    throw new Error('Failed to send magic link email');
  }
};

/**
 * Verifikasi konfigurasi email
 */
export const verifyEmailConfiguration = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    return false;
  }
};
