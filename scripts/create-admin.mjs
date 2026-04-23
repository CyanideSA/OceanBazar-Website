import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://oceanbazar:oceanbazar@localhost:5433/oceanbazar?schema=public' } },
});

const hash = bcrypt.hashSync('rjsuvosa420', 10);

try {
  const result = await prisma.$queryRawUnsafe(
    `INSERT INTO admin_users (username, name, email, password_hash, role, active)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, active = true
     RETURNING id, username, role`,
    'rjsuvosa', 'RJ Suvosa', 'rjsuvosa@oceanbazar.com', hash, 'super_admin', true
  );
  console.log('Admin created:', result);
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await prisma.$disconnect();
}
