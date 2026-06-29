import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'barbershoppaiva@gmail.com';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';
  const senhaHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { senhaHash, nome: 'Admin Paiva', role: Role.ADMIN },
    create: { nome: 'Admin Paiva', email, senhaHash, role: Role.ADMIN },
  });

  await prisma.whatsappSession.upsert({
    where: { sessionName: process.env.WA_SESSION_NAME ?? 'barbershop-main' },
    update: {},
    create: { sessionName: process.env.WA_SESSION_NAME ?? 'barbershop-main' },
  });

  console.log(`Seed pronto. Admin: ${email} / ${password}`);
}

main().finally(() => prisma.$disconnect());
