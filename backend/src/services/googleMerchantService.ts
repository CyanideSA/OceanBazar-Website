import { google } from 'googleapis';

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/content'],
    });
  } catch {
    return null;
  }
}

export function isGoogleMerchantConfigured(): boolean {
  return Boolean(getAuth() && process.env.GMC_MERCHANT_ID);
}

export async function syncProductToMerchantCenter(product: {
  id: string;
  title: string;
  description?: string;
  link: string;
  imageLink?: string;
  price: number;
  availability: 'in stock' | 'out of stock';
  brand?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const auth = getAuth();
  const merchantId = process.env.GMC_MERCHANT_ID;
  if (!auth || !merchantId) return { ok: false, error: 'not_configured' };

  try {
    const content = google.content({ version: 'v2.1', auth });
    await content.products.insert({
      merchantId,
      requestBody: {
        offerId: product.id,
        title: product.title,
        description: product.description || product.title,
        link: product.link,
        imageLink: product.imageLink,
        contentLanguage: 'en',
        targetCountry: 'BD',
        channel: 'online',
        availability: product.availability,
        condition: 'new',
        brand: product.brand || 'OceanBazar',
        price: { value: String(product.price), currency: 'BDT' },
      },
    });
    return { ok: true };
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || 'sync_failed';
    return { ok: false, error: msg };
  }
}
