import { PrismaClient } from '@prisma/client';
import {
  getTier,
  getTierInfo,
  calculatePointsEarned,
  validateRedemption,
  getRedemptionOptions,
  wouldUpgradeTier,
  type OBTier,
} from '../utils/obPoints';

const prisma = new PrismaClient();

export { getTier, getTierInfo, wouldUpgradeTier };

export async function getBalance(userId: string): Promise<number> {
  const result = await prisma.obPointsLedger.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}

export async function getUserTierInfo(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const balance = await getBalance(userId);
  const lifetimeSpend = Number(user.lifetimeSpend);
  const info = getTierInfo(lifetimeSpend);
  const options = getRedemptionOptions(info.tier, balance);

  return { balance, ...info, options };
}

export async function earnPoints(
  userId: string,
  orderId: string,
  orderTotal: number,
): Promise<{ pointsEarned: number; tierUpgrade: { upgrades: boolean; from: OBTier; to: OBTier } }> {
  const points = calculatePointsEarned(orderTotal);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const upgrade = wouldUpgradeTier(Number(user.lifetimeSpend), orderTotal);

  if (points > 0) {
    await prisma.obPointsLedger.create({
      data: {
        userId,
        type: 'earn',
        points,
        orderId,
        note: `Earned from order ${orderId}`,
      },
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lifetimeSpend: { increment: orderTotal } },
  });

  return { pointsEarned: points, tierUpgrade: upgrade };
}

export async function redeemPoints(
  userId: string,
  pointsToRedeem: number,
): Promise<{ bdtValue: number; newBalance: number }> {
  const balance = await getBalance(userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const tier = getTier(Number(user.lifetimeSpend));

  const result = validateRedemption(tier, balance, pointsToRedeem);
  if (!result.valid) {
    throw Object.assign(new Error(result.error), { status: 400 });
  }

  await prisma.obPointsLedger.create({
    data: {
      userId,
      type: 'redeem',
      points: -pointsToRedeem,
      note: `Redeemed ${pointsToRedeem} OB for ${result.bdtValue} BDT`,
    },
  });

  return { bdtValue: result.bdtValue, newBalance: balance - pointsToRedeem };
}

export async function adminAdjustPoints(
  userId: string,
  points: number,
  note: string,
): Promise<number> {
  await prisma.obPointsLedger.create({
    data: { userId, type: 'adjust', points, note },
  });
  return await getBalance(userId);
}

export async function getLedger(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [entries, total] = await Promise.all([
    prisma.obPointsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.obPointsLedger.count({ where: { userId } }),
  ]);
  return { entries, total, page, limit };
}
