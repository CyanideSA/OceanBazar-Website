/**
 * Server component that renders admin/AI-managed SEO content for an entity:
 *  - FAQPage JSON-LD (rich results)
 *  - GenericJsonLd from SeoMetadata.schemaJson
 *  - A visible, indexable FAQ / buying-guide section
 *
 * Safe to drop into any server component (product, category, brand pages).
 * Renders nothing when no SEO metadata exists.
 */
import { fetchSeoMeta } from '@/lib/seoMeta';
import { FaqJsonLd, GenericJsonLd } from '@/components/seo/JsonLd';

interface ContentBlock {
  heading?: string;
  body?: string;
}

export default async function SeoContent({
  entityType,
  entityId,
  locale = 'en',
  showVisible = true,
}: {
  entityType: 'product' | 'category' | 'brand' | 'page';
  entityId: string;
  locale?: string;
  showVisible?: boolean;
}) {
  const meta = await fetchSeoMeta(entityType, entityId, locale);
  if (!meta) return null;

  const faq = Array.isArray(meta.faq) ? meta.faq : [];
  const blocks: ContentBlock[] = Array.isArray(meta.contentBlocks)
    ? (meta.contentBlocks as ContentBlock[])
    : [];

  return (
    <>
      {meta.schemaJson && <GenericJsonLd data={meta.schemaJson} />}
      {faq.length > 0 && <FaqJsonLd faq={faq} />}

      {showVisible && (blocks.length > 0 || faq.length > 0) && (
        <section className="container-tight border-t border-border mt-8 py-8">
          {blocks.map((b, i) => (
            <div key={i} className="prose prose-sm max-w-none text-muted-foreground mb-6">
              {b.heading && <h2 className="text-lg font-bold text-foreground mb-2">{b.heading}</h2>}
              {b.body && <p>{b.body}</p>}
            </div>
          ))}

          {faq.length > 0 && (
            <div className="mt-4">
              <h2 className="text-lg font-bold text-foreground mb-3">Frequently Asked Questions</h2>
              <div className="space-y-3">
                {faq.map((f, i) => (
                  <details key={i} className="rounded-xl border border-border bg-card p-4">
                    <summary className="font-medium text-foreground cursor-pointer">{f.question}</summary>
                    <p className="mt-2 text-sm text-muted-foreground">{f.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
