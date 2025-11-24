// Cloud Function for sending OTP emails
// This would be deployed to Firebase Cloud Functions in production

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Configure email transporter (use environment variables in production)
const transporter = nodemailer.createTransport({
  service: 'gmail', // or 'SendGrid', 'AWS SES', etc.
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.password,
  },
});

/**
 * Send OTP email when a verification document is created
 */
exports.sendOTPEmail = functions.firestore
  .document('emailVerifications/{userId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { email, otp } = data;

    const mailOptions = {
      from: 'SafeRide Connect <noreply@saferide-aiub.edu>',
      to: email,
      subject: 'Your SafeRide Connect Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #3182ce 0%, #2563eb 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 10px 10px 0 0;
              }
              .content {
                background: #f8f9fa;
                padding: 30px;
                border-radius: 0 0 10px 10px;
              }
              .otp-box {
                background: white;
                border: 2px solid #3182ce;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                margin: 20px 0;
              }
              .otp-code {
                font-size: 32px;
                font-weight: bold;
                color: #3182ce;
                letter-spacing: 8px;
                margin: 10px 0;
              }
              .footer {
                text-align: center;
                color: #718096;
                font-size: 12px;
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
              }
              .warning {
                background: #fffbeb;
                border-left: 4px solid #f59e0b;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🚗 SafeRide Connect</h1>
              <p>Verify Your Email Address</p>
            </div>
            <div class="content">
              <h2>Hello!</h2>
              <p>Thank you for registering with SafeRide Connect. To complete your registration and verify your AIUB email address, please use the verification code below:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #718096; font-size: 14px;">Your Verification Code</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 0; color: #718096; font-size: 12px;">Valid for 10 minutes</p>
              </div>

              <p>Enter this code in the SafeRide Connect app to verify your email address.</p>

              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>This code expires in 10 minutes</li>
                  <li>Never share this code with anyone</li>
                  <li>SafeRide staff will never ask for this code</li>
                  <li>If you didn't request this code, please ignore this email</li>
                </ul>
              </div>

              <p>If you're having trouble verifying your email, please contact our support team at <a href="mailto:support@saferide-aiub.edu">support@saferide-aiub.edu</a>.</p>

              <p>Best regards,<br>The SafeRide Connect Team</p>
            </div>
            <div class="footer">
              <p>American International University-Bangladesh (AIUB)</p>
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; 2025 SafeRide Connect. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
      text: `
SafeRide Connect - Email Verification

Hello!

Thank you for registering with SafeRide Connect. To complete your registration and verify your AIUB email address, please use the verification code below:

Verification Code: ${otp}

This code is valid for 10 minutes.

Enter this code in the SafeRide Connect app to verify your email address.

SECURITY NOTICE:
- This code expires in 10 minutes
- Never share this code with anyone
- SafeRide staff will never ask for this code
- If you didn't request this code, please ignore this email

If you're having trouble verifying your email, please contact our support team at support@saferide-aiub.edu.

Best regards,
The SafeRide Connect Team

American International University-Bangladesh (AIUB)
This is an automated message, please do not reply to this email.
© 2025 SafeRide Connect. All rights reserved.
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`OTP email sent successfully to ${email}`);
      return { success: true };
    } catch (error) {
      console.error('Error sending OTP email:', error);
      throw new functions.https.HttpsError('internal', 'Failed to send OTP email');
    }
  });

/**
 * Clean up expired OTP verification documents
 * Runs daily at midnight
 */
exports.cleanupExpiredOTPs = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('Asia/Dhaka')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    
    const expiredDocs = await db.collection('emailVerifications')
      .where('expiresAt', '<', now)
      .get();

    const batch = db.batch();
    expiredDocs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Cleaned up ${expiredDocs.size} expired OTP documents`);
    return { deletedCount: expiredDocs.size };
  });
