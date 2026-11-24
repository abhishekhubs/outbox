import nodemailer from 'nodemailer';

async function test() {
  console.log('Testing Ethereal SMTP connection...');
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'kaitlyn.ledner66@ethereal.email',
      pass: 'jztZDwCES8kP21Nt1F',
    },
  });

  await transporter.verify();
  console.log('✅ SMTP connection verified successfully!');

  const info = await transporter.sendMail({
    from: '"Outbox Platform" <kaitlyn.ledner66@ethereal.email>',
    to: 'abhisheksit27@gmail.com',
    subject: 'Test delivery from Outbox',
    html: '<b>Hello!</b> Your Outbox Email Scheduler is working perfectly!',
  });

  console.log('✅ Email sent!');
  console.log('Message ID:', info.messageId);
  console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
}

test().catch(console.error);
