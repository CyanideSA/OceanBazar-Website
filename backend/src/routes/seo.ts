import { Router, Request, Response } from 'express';
import { getSeo, buildFaqJsonLd } from '../services/seoService';

/**
 * Public, read-only SEO metadata for the storefront (consumed by Next.js
 * generateMetadata, JsonLd, and category content blocks). Cached at the edge.
 */
const router = Router();

router.get('/:entityType/:entityId', async (req: Request, res: Response) => {
  const locale = (req.query.locale as string) || 'en';
  const meta = await getSeo(String(req.params.entityType), String(req.params.entityId), locale);
  if (!meta) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const faqJsonLd = Array.isArray(meta.faq) ? buildFaqJsonLd(meta.faq as { question: string; answer: string }[]) : null;
  res.set('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400');
  res.json({
    metaTitle: meta.metaTitle,
    metaDescription: meta.metaDescription,
    keywords: meta.keywords,
    canonicalUrl: meta.canonicalUrl,
    ogTitle: meta.ogTitle,
    ogDescription: meta.ogDescription,
    ogImage: meta.ogImage,
    schemaJson: meta.schemaJson,
    faq: meta.faq,
    faqJsonLd,
    contentBlocks: meta.contentBlocks,
    seoScore: meta.seoScore,
  });
});

export default router;
