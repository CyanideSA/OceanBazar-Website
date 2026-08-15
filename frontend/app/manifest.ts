import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Oceanbazar — বাংলাদেশের সেরা অনলাইন শপ',
    short_name: 'Oceanbazar',
    description: 'Retail & Wholesale ecommerce for Bangladesh',
    start_url: '/bn',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2E7CF6',
    orientation: 'portrait',
    categories: ['shopping', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/ios/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/icons/android/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/android/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/windows/icon-256.png', sizes: '256x256', type: 'image/png' },
      { src: '/icons/mac/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcuts: [
      { name: 'Products', url: '/bn/products', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
      { name: 'My Orders', url: '/bn/account/orders', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
      { name: 'Cart', url: '/bn/cart', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
    ],
  };
}
