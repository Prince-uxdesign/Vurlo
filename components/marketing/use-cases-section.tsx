import { siteConfig } from "@/config/site";
import { Code2, Compass, Megaphone, Palette, Sparkles, Ticket } from "lucide-react";
import { Container } from "@/components/ui/container";

const host = siteConfig.shortLinkHost;

export function UseCasesSection() {
  return (
    <section
      id="use-cases"
      aria-labelledby="use-cases-title"
      className="scroll-mt-16 py-16 md:py-24"
    >
      <Container>
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-(--color-mist-300) bg-white px-3 py-1 text-[12px] font-semibold text-(--color-slate-700)">
            <span className="size-2 rounded-full bg-(--color-ember-700)" />
            Real-world utility
          </span>
          <h2
            id="use-cases-title"
            className="mt-4 text-[30px] font-bold leading-tight tracking-tight sm:text-[38px] md:text-[44px] text-(--color-ink-900)"
          >
            Engineered for anyone who shares links with intent.
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-(--color-slate-700) md:text-body-l">
            Whether dropped in a high-traffic bio, printed on a wine bottle, or
            shared in technical documentation, Vurlo keeps every touchpoint
            sharp.
          </p>
        </div>

        {/* Asymmetrical Editorial Grid */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Card 1: Creators & Streamers (Wide 7 cols) */}
          <div className="flex flex-col justify-between rounded-(--radius-lg) border border-(--color-ink-900) bg-white p-6 shadow-[4px_4px_0_#000] md:col-span-7 sm:p-8">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-(--color-tint-yellow) border border-(--color-tint-yellow-border) px-3 py-1 text-[12px] font-semibold text-(--color-ink-900)">
                  Creators & Streamers
                </span>
                <Sparkles size={18} className="text-(--color-ember-700)" />
              </div>
              <h3 className="mt-4 text-[22px] font-bold tracking-tight text-(--color-ink-900)">
                Clean bio links that never break past videos.
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-(--color-slate-700)">
                Swap your latest video or sponsor link in seconds without
                touching hundreds of past YouTube descriptions or Instagram
                highlights.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-(--radius-md) border border-(--color-mist-300) bg-(--color-paper) px-4 py-2.5">
              <span className="font-mono text-[13px] font-bold text-(--color-ink-900)">
                {host}/new-video
              </span>
              <span className="text-[12px] font-medium text-(--color-success-700)">
                307 Edge Redirect
              </span>
            </div>
          </div>

          {/* Card 2: Freelancers & Studios (5 cols) */}
          <div className="flex flex-col justify-between rounded-(--radius-lg) border border-(--color-mist-300) bg-(--color-paper) p-6 md:col-span-5 sm:p-8">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white border border-(--color-mist-300) px-3 py-1 text-[12px] font-semibold text-(--color-slate-700)">
                  Freelancers & Studios
                </span>
                <Palette size={18} className="text-(--color-ink-900)" />
              </div>
              <h3 className="mt-4 text-[20px] font-bold tracking-tight text-(--color-ink-900)">
                Portfolio & client proposals with polish.
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-(--color-slate-700)">
                Send prospective clients a branded short link that reflects your
                attention to typography, craft, and detail.
              </p>
            </div>
            <div className="mt-6 rounded-(--radius-md) border border-(--color-mist-300) bg-white px-4 py-2.5">
              <span className="font-mono text-[13px] font-bold text-(--color-ink-900)">
                {host}/portfolio-2026
              </span>
            </div>
          </div>

          {/* Card 3: Small Businesses & Hospitality (5 cols) */}
          <div className="flex flex-col justify-between rounded-(--radius-lg) border border-(--color-mist-300) bg-(--color-paper) p-6 md:col-span-5 sm:p-8">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white border border-(--color-mist-300) px-3 py-1 text-[12px] font-semibold text-(--color-slate-700)">
                  Hospitality & Retail
                </span>
                <Compass size={18} className="text-(--color-ink-900)" />
              </div>
              <h3 className="mt-4 text-[20px] font-bold tracking-tight text-(--color-ink-900)">
                Print QR codes on tables and flyers once.
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-(--color-slate-700)">
                Update daily specials, happy hour times, and seasonal menus
                without ever reprinting physical cards.
              </p>
            </div>
            <div className="mt-6 rounded-(--radius-md) border border-(--color-mist-300) bg-white px-4 py-2.5">
              <span className="font-mono text-[13px] font-bold text-(--color-ink-900)">
                {host}/menu
              </span>
            </div>
          </div>

          {/* Card 4: Growth Marketers (7 cols) */}
          <div className="flex flex-col justify-between rounded-(--radius-lg) border border-(--color-ink-900) bg-(--color-tint-blue) p-6 shadow-[4px_4px_0_#000] md:col-span-7 sm:p-8">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white border border-(--color-tint-blue-border) px-3 py-1 text-[12px] font-semibold text-(--color-ink-900)">
                  Growth & Campaigns
                </span>
                <Megaphone size={18} className="text-(--color-ember-700)" />
              </div>
              <h3 className="mt-4 text-[22px] font-bold tracking-tight text-(--color-ink-900)">
                Multi-channel UTM tracking without link clutter.
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-(--color-slate-700)">
                Tag campaign source, medium, and term directly in the Vurlo
                builder. Keep your public link clean while passing full
                analytics downstream.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-(--radius-md) border border-(--color-ink-900) bg-white px-4 py-2.5">
              <span className="font-mono text-[13px] font-bold text-(--color-ink-900)">
                {host}/spring?utm_source=ig
              </span>
              <span className="font-mono text-[12px] text-(--color-stone-500)">
                UTM Attached
              </span>
            </div>
          </div>

          {/* Card 5: Event Organizers (6 cols) */}
          <div className="flex flex-col justify-between rounded-(--radius-lg) border border-(--color-mist-300) bg-white p-6 md:col-span-6 sm:p-8">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-(--color-mist-100) px-3 py-1 text-[12px] font-semibold text-(--color-slate-700)">
                  Events & Venues
                </span>
                <Ticket size={18} className="text-(--color-ink-900)" />
              </div>
              <h3 className="mt-4 text-[20px] font-bold tracking-tight text-(--color-ink-900)">
                One short URL on all badge lanyards and posters.
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-(--color-slate-700)">
                Attendees can easily type the link or scan the vector QR from
                across the exhibition hall.
              </p>
            </div>
            <div className="mt-6 rounded-(--radius-md) border border-(--color-mist-300) bg-(--color-paper) px-4 py-2.5">
              <span className="font-mono text-[13px] font-bold text-(--color-ink-900)">
                {host}/rsvp
              </span>
            </div>
          </div>

          {/* Card 6: Developers & Engineers (6 cols) */}
          <div className="flex flex-col justify-between rounded-(--radius-lg) border border-(--color-mist-300) bg-white p-6 md:col-span-6 sm:p-8">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-(--color-mist-100) px-3 py-1 text-[12px] font-semibold text-(--color-slate-700)">
                  Developers & Engineering
                </span>
                <Code2 size={18} className="text-(--color-ink-900)" />
              </div>
              <h3 className="mt-4 text-[20px] font-bold tracking-tight text-(--color-ink-900)">
                Concise shortcuts for docs, repos, and issues.
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-(--color-slate-700)">
                Share lightweight links in commit messages, release notes, and
                pull requests without cluttering the thread.
              </p>
            </div>
            <div className="mt-6 rounded-(--radius-md) border border-(--color-mist-300) bg-(--color-paper) px-4 py-2.5">
              <span className="font-mono text-[13px] font-bold text-(--color-ink-900)">
                {host}/api-docs
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
