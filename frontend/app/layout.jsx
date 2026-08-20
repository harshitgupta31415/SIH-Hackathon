import 'leaflet/dist/leaflet.css';
import '../src/index.css';

import ClientProviders from './providers';

// oxlint-disable-next-line react/only-export-components -- Next.js reads route metadata exports from layout modules.
export const metadata = {
  title: {
    default: 'Jal Jeevan Swasthya',
    template: '%s | Jal Jeevan Swasthya',
  },
  description: 'Smart community health monitoring and early warning for water-borne diseases.',
  icons: { icon: '/favicon.svg' },
};

// oxlint-disable-next-line react/only-export-components -- Next.js reads viewport exports from layout modules.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
