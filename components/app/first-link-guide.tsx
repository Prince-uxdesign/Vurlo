import { BarChart3, Copy, QrCode } from "lucide-react";

const STEPS = [
  { Icon: Copy, text: "Copy your short link and share it anywhere." },
  { Icon: BarChart3, text: "Clicks, countries and devices show up here as people use it." },
  { Icon: QrCode, text: "Every link gets a QR code for print and screens." },
];

/**
 * Beside the create panel on a brand-new account: three short lines on what
 * happens next. The action itself is the panel; this only sets expectations.
 */
export function FirstLinkGuide() {
  return (
    <section aria-labelledby="guide-title" className="rounded-(--radius-lg) border border-(--color-border) bg-white p-4 sm:p-5">
      <h2 id="guide-title" className="text-h3">What happens next</h2>
      <ul className="mt-3 space-y-3">
        {STEPS.map(({ Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <Icon size={18} aria-hidden="true" className="mt-0.5 flex-none text-(--color-muted)" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <p className="text-small mt-4 border-t border-(--color-border) pt-3 text-(--color-muted)">
        You can have up to 50 active links at a time.
      </p>
    </section>
  );
}
