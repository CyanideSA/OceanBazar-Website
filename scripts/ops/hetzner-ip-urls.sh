#!/bin/bash
cd /root/oceanbazar
grep -q '^NEXT_PUBLIC_SITE_URL=' .env && sed -i 's|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=http://5.223.64.13|' .env || echo 'NEXT_PUBLIC_SITE_URL=http://5.223.64.13' >> .env
grep -q '^NEXT_PUBLIC_API_URL=' .env && sed -i 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://5.223.64.13|' .env || echo 'NEXT_PUBLIC_API_URL=http://5.223.64.13' >> .env
grep -q '^CLIENT_URL=' .env && sed -i 's|^CLIENT_URL=.*|CLIENT_URL=http://5.223.64.13|' .env || echo 'CLIENT_URL=http://5.223.64.13' >> .env
grep -q '^BFF_PUBLIC_BASE_URL=' .env && sed -i 's|^BFF_PUBLIC_BASE_URL=.*|BFF_PUBLIC_BASE_URL=http://5.223.64.13|' .env || echo 'BFF_PUBLIC_BASE_URL=http://5.223.64.13' >> .env
grep -q '^ADMIN_URL=' .env && sed -i 's|^ADMIN_URL=.*|ADMIN_URL=http://5.223.64.13|' .env || echo 'ADMIN_URL=http://5.223.64.13' >> .env
grep -q '^VITE_ADMIN_API_URL=' .env && sed -i 's|^VITE_ADMIN_API_URL=.*|VITE_ADMIN_API_URL=http://5.223.64.13|' .env || echo 'VITE_ADMIN_API_URL=http://5.223.64.13' >> .env
echo ip urls updated
