import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { HubProvider } from '@/lib/store';
import { AuthProvider } from '@/lib/auth';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'HILS Hub',
  description: 'HILS 학칙 기반 학교 운영 시스템 (시안)',
  icons: { icon: '/hils-logo.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <HubProvider>
            <Shell>{children}</Shell>
          </HubProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
