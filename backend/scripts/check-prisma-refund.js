const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
console.log('refund=' + typeof p.refund_records);
console.log('keys=' + Object.keys(p).filter((k) => /refund|return/i.test(k)).join(','));
p.$disconnect();
