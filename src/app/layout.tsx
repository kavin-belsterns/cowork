import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Room Booking',
  description: 'Room booking and visitor management',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading the request header makes every page render per request. The CSP nonce changes each time.
  const nonce = (await headers()).get('x-nonce') ?? '';
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta property="csp-nonce" content={nonce} />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
