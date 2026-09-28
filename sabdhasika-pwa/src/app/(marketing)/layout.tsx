import { AccountBootstrap } from "@/components/providers/AccountBootstrap";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteNav } from "@/components/marketing/SiteNav";

/**
 * The public site: the landing page, sign in, and create account.
 *
 * It is a route group and not a path segment, so `/`, `/signin` and
 * `/register` sit at the top level — where people expect to find them, and
 * where a bookmark or a link from elsewhere will land.
 *
 * ── Why there are no providers here ─────────────────────────────────
 *
 * `AppProviders` gates its children on an IndexedDB read and holds a boot
 * splash while it does. That is right for the app and wrong for this: a
 * marketing page must paint from the server in the first frame, and an auth
 * page that shows a spinner before it shows a form has invented a problem. So
 * the only thing mounted here is `AccountBootstrap`, which starts the read
 * without waiting for it. The nav and the forms subscribe and settle when it
 * lands. See `AccountBootstrap` for the full reasoning.
 *
 * ── The surface language ────────────────────────────────────────────
 *
 * This tree speaks Linear, not the app's paper-and-ink. `data-surface="marketing"`
 * is the scope: it switches the selection colour, the focus ring and
 * `color-scheme` to suit a near-black page (see globals.css), and every
 * component below uses the `void`/`carbon`/`acid` tokens rather than the
 * `paper`/`surface`/`accent` ones. The two languages share a stylesheet and
 * nothing else.
 *
 * The fixed backdrop is not redundant with the background on this element. It
 * covers the overscroll bounce, where the `<body>`'s own light background would
 * otherwise flash through at the top and bottom of a dark page.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-surface="marketing"
      className="font-marketing relative flex min-h-svh flex-col bg-void text-bone"
    >
      <div className="pointer-events-none fixed inset-0 -z-10 bg-void" aria-hidden="true" />
      <AccountBootstrap />
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
