import Link from 'next/link';

export default function RootNotFound() {
  return (
    <div style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0a0a0a', color: '#f1f5f9' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🌊</div>
        <h1 style={{ fontSize: '6rem', fontWeight: 900, color: '#0ea5e9', margin: 0, lineHeight: 1 }}>404</h1>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9', margin: '1rem 0 0.5rem' }}>Page Not Found</h2>
        <p style={{ color: '#94a3b8', maxWidth: '360px', marginBottom: '2rem' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/bn"
          style={{ display: 'inline-block', padding: '12px 28px', background: '#0ea5e9', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontWeight: 700 }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
