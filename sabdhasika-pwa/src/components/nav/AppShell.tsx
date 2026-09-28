import { BottomNav } from "@/components/nav/BottomNav";
import { SideNav } from "@/components/nav/SideNav";

/**
 * The shell for every tabbed screen. Mobile gets a single column with a
 * floating pill nav; desktop gets a sidebar and a comfortable reading column.
 *
 * The column is 768px on phones and tablets and widens to 1040px from `lg`,
 * where the sidebar has taken its 268px and there is real room left over. The
 * pages then decide what to do with that width — see `learn/page.tsx`, which
 * pairs its secondary panels and splits the primary card. A single 768px column
 * on a 1440px screen would leave a third of the window empty while still
 * forcing the reader to scroll.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-28 pt-safe lg:max-w-[1040px] lg:px-10 lg:pb-14 lg:pt-10">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

/** A page header with a large title and optional trailing slot. */
export function PageHeader({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.025em] text-ink lg:text-[32px]">
          {title}
        </h1>
      </div>
      {trailing}
    </header>
  );
}
