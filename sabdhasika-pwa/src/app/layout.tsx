import type { Metadata, Viewport } from "next";
import { Figtree, Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
});

/**
 * The marketing typeface — see `font-marketing` in globals.css.
 *
 * Loaded as a variable font, so the whole 100–900 axis is available and the
 * 510 weight the marketing design leans on is a real weight rather than a
 * synthesised one. It is declared here because `next/font` requires the
 * variable to be on an ancestor, but only the marketing layout applies it —
 * the app keeps Figtree.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SabdhaSika — learn the words that matter",
    template: "%s · SabdhaSika",
  },
  description:
    "A daily vocabulary ritual. Learn the most frequently used words in any language, 20–30 at a time.",
  applicationName: "SabdhaSika",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SabdhaSika",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
};

/**
 * The theme is applied before first paint by a tiny inline script so a dark
 * mode user never sees a white flash. It reads the same persisted key the
 * store writes, and never throws if storage is unavailable.
 */
const themeBootstrap = `(function(){try{
var raw=localStorage.getItem('sabdhasika:app-state');
var t=raw?JSON.parse(raw).settings.theme:'system';
var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.setAttribute('data-theme',dark?'dark':'light');
}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${instrumentSerif.variable} ${inter.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-svh bg-paper font-sans text-ink antialiased">
        {/*
          The app providers deliberately live in the route groups that need
          them, not here. They gate the tree on an IndexedDB read and hold a
          boot splash while they do it — which is right for the app and wrong
          for the landing and auth pages, which are static and must paint
          immediately. See `(marketing)/layout.tsx` and `(app)/layout.tsx`.
        */}
        {children}
      </body>
    </html>
  );
}
