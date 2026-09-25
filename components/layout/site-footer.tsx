import Link from "next/link";
import { Container } from "@/components/ui/container";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

/**
 * Placeholder destinations — replaced with real routes in later phases.
 * Columns intentionally mirror the future sitemap, not invented extras.
 */
const columns: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Changelog", href: "#changelog" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: "#docs" },
      { label: "Support", href: "#support" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "#privacy" },
      { label: "Terms", href: "#terms" },
    ],
  },
];

/** Footer system — warm dark surface, brand + columns + base row. */
export function SiteFooter() {
  return (
    <footer className="bg-(--color-surface-dark) text-white">
      <Container className="py-10 md:py-12">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <p className="text-h3">Vurlo</p>
            <p className="text-small mt-2 max-w-xs opacity-70">
              Simple to create. Powerful to manage. Useful after the click.
            </p>
          </div>
          {columns.map((column) => (
            <nav key={column.heading} aria-label={`Footer — ${column.heading}`}>
              <p className="text-label">{column.heading}</p>
              <ul className="mt-3 grid gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-small opacity-70 hover:opacity-100 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-white/15 pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-small opacity-70">
            © 2026 Vurlo. All rights reserved.
          </p>
          <p className="text-small opacity-70">Built for people who share links.</p>
        </div>
      </Container>
    </footer>
  );
}
