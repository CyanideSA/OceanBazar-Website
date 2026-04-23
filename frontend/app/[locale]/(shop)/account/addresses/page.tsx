'use client';

import { useTranslations } from 'next-intl';
import AddressBookPanel from '@/components/account/AddressBookPanel';

export default function AccountAddressesPage() {
  const t = useTranslations('account');

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('addresses')}</h1>
      <AddressBookPanel />
    </div>
  );
}
