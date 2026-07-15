import { google } from 'googleapis';

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly',
      ],
    });
  } catch {
    return null;
  }
}

export function isGoogleInsightsConfigured(): boolean {
  return Boolean(getAuth() && process.env.GA4_PROPERTY_ID);
}

export async function fetchGa4Overview(days = 7): Promise<{
  sessions: number;
  users: number;
  pageViews: number;
  topPages: Array<{ path: string; views: number }>;
} | null> {
  const auth = getAuth();
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!auth || !propertyId) return null;

  try {
    const analytics = google.analyticsdata({ version: 'v1beta', auth });
    const { data } = await analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
        ],
        dimensions: [{ name: 'pagePath' }],
        limit: '10',
        orderBys: [{ desc: true, metric: { metricName: 'screenPageViews' } }],
      },
    });

    const totals = data.totals?.[0]?.metricValues || [];
    const rows = data.rows || [];

    return {
      sessions: Number(totals[0]?.value || 0),
      users: Number(totals[1]?.value || 0),
      pageViews: Number(totals[2]?.value || 0),
      topPages: rows.map((r) => ({
        path: r.dimensionValues?.[0]?.value || '/',
        views: Number(r.metricValues?.[2]?.value || 0),
      })),
    };
  } catch (err: unknown) {
    console.error('[google-insights] GA4 error:', (err as Error)?.message);
    return null;
  }
}

export async function fetchSearchConsoleQueries(days = 7): Promise<Array<{
  query: string;
  clicks: number;
  impressions: number;
}> | null> {
  const auth = getAuth();
  const siteUrl = process.env.GSC_SITE_URL;
  if (!auth || !siteUrl) return null;

  try {
    const searchconsole = google.searchconsole({ version: 'v1', auth });
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    const { data } = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        dimensions: ['query'],
        rowLimit: 15,
      },
    });

    return (data.rows || []).map((r) => ({
      query: r.keys?.[0] || '',
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
    }));
  } catch (err: unknown) {
    console.error('[google-insights] GSC error:', (err as Error)?.message);
    return null;
  }
}
