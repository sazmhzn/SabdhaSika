import {
  CalendarCheck,
  Gauge,
  ListOrdered,
  Repeat,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

/**
 * Key benefits.
 *
 * Each one is anchored to something the product actually does, and where a
 * number is quoted it is the real one — the daily goal range comes from the
 * `Settings` type, the offline claim from the service worker, the local-only
 * claim from the account layer. A benefits grid is the easiest place on a
 * marketing site to write things that are merely pleasant, so every line here
 * is checkable against the code.
 */
const BENEFITS = [
  {
    icon: ListOrdered,
    title: "Ranked, not themed",
    body: "Words arrive in frequency order — the order they will actually show up when you read or listen. No “10 words for the airport” lists that leave out the words doing the real work.",
  },
  {
    icon: Gauge,
    title: "Five minutes, honestly",
    body: "Twenty words is a session. The daily goal is yours to set between 10 and 30, and the session ends when the queue is empty rather than when a timer runs out.",
  },
  {
    icon: Repeat,
    title: "It remembers for you",
    body: "Spaced repetition brings each word back just before you would forget it, so a session is a mix of new words and reviews due today — never a pile you have to manage.",
  },
  {
    icon: WifiOff,
    title: "Works with the network off",
    body: "Install it once and it runs offline: the words, your progress and the scheduler all live on the device. A commute with no signal is a normal place to study.",
  },
  {
    icon: ShieldCheck,
    title: "No server, no tracking",
    body: "Your progress is written to this device and nowhere else. There is no analytics pipeline and no sync account to sign up for — which is also why it works offline.",
  },
  {
    icon: CalendarCheck,
    title: "A streak that forgives",
    body: "Miss a day and the streak resets, but nothing else does. Due words stay due and come back in your next session, re-spaced rather than dumped on you at once.",
  },
] as const;

export function Benefits() {
  return (
    <section id="benefits" className="scroll-mt-24 border-t border-graphite bg-void">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-20 lg:px-10 lg:py-24">
        <div className="max-w-[54ch]">
          <p className="text-[11px] font-[510] uppercase tracking-[0.14em] text-ash">Why it works</p>
          <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.75rem)] font-[510] leading-[1.08] tracking-[-0.028em] text-white">
            Six things it does
            <br />
            that most lists don&rsquo;t.
          </h2>
        </div>

        <ul className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title}>
              <span className="grid size-10 place-items-center rounded-mkt-sm border border-graphite bg-carbon text-fog">
                <benefit.icon className="size-[18px]" strokeWidth={2} />
              </span>
              <h3 className="mt-5 text-[15.5px] font-[510] tracking-[-0.01em] text-bone">
                {benefit.title}
              </h3>
              <p className="mt-2.5 max-w-[42ch] text-[14px] leading-relaxed text-fog">
                {benefit.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
