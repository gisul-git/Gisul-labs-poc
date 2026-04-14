import './globals.css';
import Script from 'next/script';

export const metadata = { title: 'VM Manager' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Script id="novnc" strategy="beforeInteractive" type="module">{`
          import RFB from 'https://cdn.jsdelivr.net/npm/@novnc/novnc@1.4.0/core/rfb.js';
          window.RFB = RFB;
        `}</Script>
        {children}
      </body>
    </html>
  );
}
