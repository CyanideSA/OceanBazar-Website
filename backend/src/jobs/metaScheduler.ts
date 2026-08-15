import { prisma } from '../lib/prisma';

import { publishMetaPost } from '../services/meta/metaClient';

const prismaAny = prisma as any;

export async function runMetaPostScheduler(): Promise<void> {
  const due = await prismaAny.meta_posts.findMany({
    where: { status: 'scheduled', scheduled_at: { lte: new Date() } },
    take: 10,
  });
  if (!due.length) return;

  const account = await prismaAny.meta_accounts.findFirst({ where: { status: 'connected' } });
  const pageId = account?.page_id || process.env.META_PAGE_ID;
  if (!pageId) return;

  for (const post of due) {
    const media = Array.isArray(post.media_urls) ? post.media_urls[0] : null;
    const result = await publishMetaPost({
      postType: post.post_type || 'image',
      pageId,
      igId: account?.ig_id || process.env.META_IG_ID,
      caption: post.caption,
      mediaUrl: typeof media === 'string' ? media : undefined,
      pageToken: account?.page_access_token,
    });
    await prismaAny.meta_posts.update({
      where: { id: post.id },
      data: {
        status: result.ok ? 'published' : 'failed',
        external_post_id: result.postId || null,
        error: result.error || null,
        updated_at: new Date(),
      },
    });
  }
}

/** Call from app startup cron if META_SCHEDULER=true */
export function startMetaScheduler(intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    runMetaPostScheduler().catch((e) => console.error('[meta-scheduler]', e));
  }, intervalMs);
}
