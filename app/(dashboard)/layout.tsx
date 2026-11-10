'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/ui/Sidebar';
import { Header } from '@/components/ui/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const isInitialized = !isLoading && isAuthenticated;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('Redirecting to login - not authenticated');
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <rect x="10" y="10" width="20" height="20" fill="#E8A800" rx="2" />
          </svg>
        </div>
        <p>Loading...</p>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            background: var(--color-white-warm);
          }

          .loading-spinner svg {
            animation: pulse 1.5s ease-in-out infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.95); }
          }

          p {
            font-family: var(--font-mono);
            font-size: 13px;
            color: var(--color-ink-soft);
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <p>Initializing...</p>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            background: var(--color-white-warm);
          }

          p {
            font-family: var(--font-mono);
            font-size: 13px;
            color: var(--color-ink-soft);
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content">
        <Header />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
