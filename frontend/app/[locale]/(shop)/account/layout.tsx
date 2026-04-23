import AccountLayoutClient from '@/components/account/AccountLayoutClient';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountLayoutClient>{children}</AccountLayoutClient>;
}
