import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { HubProvider } from '@/lib/store';
import { AuthProvider } from '@/lib/auth';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'HILS Hub',
  description: 'HILS 학칙 기반 학교 운영 시스템 (시안)',
  icons: { icon: '/hils-logo.png' },
};

// 휴대폰에서 화면 너비에 맞추고, 주소창 색을 학교 색으로
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#124046' };

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
