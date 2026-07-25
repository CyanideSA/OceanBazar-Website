import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Bengali } from 'next/font/google';
import MetaPixel from '@/components/analytics/MetaPixel';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://oceanbazar.com';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const notoSansBengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-bengali',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Oceanbazar — বাংলাদেশের সেরা অনলাইন শপ',
    template: '%s | Oceanbazar',
  },
  description:
    'Oceanbazar — বাংলাদেশের অন্যতম সেরা অনলাইন শপিং প্ল্যাটফর্ম। Retail ও Wholesale-এ সেরা দামে ইলেকট্রনিক্স, পোশাক, গৃহসজ্জা ও আরও অনেক কিছু।',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Oceanbazar',
    title: 'Oceanbazar — বাংলাদেশের সেরা অনলাইন শপ',
    description: 'Retail & Wholesale ecommerce for Bangladesh. Best prices guaranteed.',
    images: [{ url: '/images/og-image.jpg', width: 1200, height: 630, alt: 'Oceanbazar' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Oceanbazar',
    description: "Bangladesh's best online shop",
    images: ['/images/og-image.jpg'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

// #region agent log
// Early (pre-hydration) global error capture for debug session 078c95.
// Runs before any chunk so it catches the real exception that blocks hydration
// on old devices. ES5-only for old WebKit. Beacons to prod /api/client-errors.
const EARLY_ERROR_CAPTURE = `(function(){
  try {
    var sent = 0;
    function beacon(hyp, msg, extra){
      if (sent >= 6) return; sent++;
      try {
        var snap = { sessionId:'078c95', runId:'early-capture', hypothesisId:hyp,
          location:'layout.tsx:early', message:msg,
          data: { ua:(navigator.userAgent||'').slice(0,180), href:location.href,
            path:location.pathname, chunks: (function(){ try {
              var s=document.querySelectorAll('script[src*="_next/static/chunks/"]'); var a=[];
              for (var i=0;i<s.length && a.length<6;i++){ var m=(s[i].src||'').split('/chunks/')[1]; if(m)a.push(m); }
              return a; } catch(e){ return null; } })(),
            online: (navigator.onLine!==undefined?navigator.onLine:null),
            conn: (navigator.connection&&navigator.connection.effectiveType)||null,
            extra: extra||null }, timestamp: Date.now() };
        var body = JSON.stringify({ message:'[debug-078c95] '+msg, url:location.href,
          userAgent:navigator.userAgent, snapshot:snap });
        if (navigator.sendBeacon) { navigator.sendBeacon('/api/client-errors', new Blob([body],{type:'application/json'})); return; }
        var x = new XMLHttpRequest(); x.open('POST','/api/client-errors',true);
        x.setRequestHeader('Content-Type','application/json'); x.send(body);
      } catch(e){}
    }
    window.addEventListener('error', function(ev){
      var t = ev && ev.target;
      if (t && (t.tagName==='SCRIPT'||t.tagName==='LINK')) {
        beacon('H14','resource load error',{ src:(t.src||t.href||'').slice(0,160), tag:t.tagName });
      } else {
        beacon('H13','window error',{ msg:String((ev&&ev.message)||'').slice(0,220),
          file:String((ev&&ev.filename)||'').slice(0,140), line:(ev&&ev.lineno)||null, col:(ev&&ev.colno)||null,
          stack:String((ev&&ev.error&&ev.error.stack)||'').slice(0,400) });
      }
    }, true);
    window.addEventListener('unhandledrejection', function(ev){
      var r = ev && ev.reason;
      beacon('H13','unhandledrejection',{ msg:String((r&&r.message)||r||'').slice(0,220),
        stack:String((r&&r.stack)||'').slice(0,400) });
    });
    window.addEventListener('pageshow', function(ev){
      if (ev && ev.persisted) beacon('H15','bfcache restore (persisted)',{});
    });
    // Hydration watchdog: if the shop shell never marks itself hydrated, report it.
    setTimeout(function(){
      if (!window.__ob_hydrated) beacon('H16','no-hydration after 8s',{});
    }, 8000);
  } catch(e){}
})();`;
// #endregion

/** ES5: send low-memory / low-core devices to the Lite storefront unless they chose Full. */
const LITE_DEVICE_HINT = `(function(){
  try {
    if (/[?&]ob_view=full(?:&|$)/.test(location.search)) return;
    var m = document.cookie.match(/(?:^|; )ob_view=([^;]*)/);
    var view = m ? decodeURIComponent(m[1]) : '';
    if (view === 'full' || view === 'lite') return;
    var mem = navigator.deviceMemory;
    var cores = navigator.hardwareConcurrency;
    var ua = navigator.userAgent || '';
    var oldIos = /iP(hone|od|ad).*OS (1[0-5])_/.test(ua);
    var weak = oldIos || (typeof mem === 'number' && mem <= 4) || (typeof cores === 'number' && cores > 0 && cores <= 4);
    if (!weak) return;
    var lite = ${JSON.stringify(
      (process.env.NEXT_PUBLIC_LITE_SITE_URL || 'https://lite.oceanbazar.com.bd').replace(/\/$/, ''),
    )};
    var next = location.pathname + location.search + location.hash;
    location.replace(lite + '/prefer?view=lite&next=' + encodeURIComponent(next || '/bn'));
  } catch (e) {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning className={`${inter.variable} ${notoSansBengali.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LITE_DEVICE_HINT }} />
        {/* #region agent log */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_ERROR_CAPTURE }} />
        {/* #endregion */}
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        {children}
        <MetaPixel />
      </body>
    </html>
  );
}
