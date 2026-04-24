import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Solana AMM DEX',
  description: 'Minimal Automated Market Maker DEX Interface',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}