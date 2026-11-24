import { PrismaClient } from '@prisma/client';
import { encrypt } from '../src/utils/encryption';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data for Outbox Email Scheduler...');

  // 1. Create or upsert demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@reachinbox.test' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      googleId: 'google-oauth2|demo-user-12345',
      email: 'demo@reachinbox.test',
      name: 'Demo Architect',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    },
  });

  // 2. Create default sender account
  const encryptedPass = encrypt('jztZDwCES8kP21Nt1F');

  await prisma.sender.upsert({
    where: {
      userId_email: {
        userId: user.id,
        email: 'kaitlyn.ledner66@ethereal.email',
      },
    },
    update: {
      smtpUser: 'kaitlyn.ledner66@ethereal.email',
      encryptedSmtpPass: encryptedPass,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      userId: user.id,
      email: 'kaitlyn.ledner66@ethereal.email',
      displayName: 'Outbox Delivery Team',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUser: 'kaitlyn.ledner66@ethereal.email',
      encryptedSmtpPass: encryptedPass,
      hourlyLimit: 200,
      minimumSendDelay: 2000,
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
