import prisma from './src/config/database';

async function main() {
  const emails = await prisma.scheduledEmail.findMany({
    select: {
      id: true,
      recipient: true,
      status: true,
      errorMessage: true,
      retryCount: true,
      sender: {
        select: {
          email: true,
          smtpUser: true,
          smtpHost: true,
          smtpPort: true,
        },
      },
    },
  });
  console.log('--- EMAILS IN DB ---');
  console.log(JSON.stringify(emails, null, 2));
}

main().finally(() => prisma.$disconnect());
