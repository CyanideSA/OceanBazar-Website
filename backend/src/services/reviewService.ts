import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function refreshProductReviewStats(productId: string): Promise<void> {
  const agg = await prisma.productReview.aggregate({
    where: { productId, status: 'approved' },
    _avg: { rating: true },
    _count: true,
  });
  const avg = agg._avg.rating;
  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAvg: avg != null ? avg : null,
      reviewCount: agg._count,
    },
  });
}
