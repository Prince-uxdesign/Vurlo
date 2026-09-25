import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { footerColumns } from "./content";

export function MarketingFooter() {
  return (
    <footer className="bg-(--color-surface-dark) text-white">
      <Container className="py-10 md:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="text-[22px] font-extrabold tracking-tight">
              Vurlo<span className="text-(--color-blaze-500)">.</span>
            </p>
            <p className="text-small mt-2 max-w-xs text-white/75">
              Short links you can manage and understand. Simple to create,
              useful after the click.
            </p>
          </div>
          {footerColumns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="text-label">{column.heading}</p>
              <ul className="mt-3 grid gap-1">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <a
                        href={link.href}
                        className="text-small inline-flex min-h-11 min-w-11 items-center text-white/75 hover:text-white hover:underline"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <span className="text-small inline-flex min-h-11 items-center text-white/55">
                        {link.label} · coming soon
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="text-small mt-10 border-t border-white/15 pt-6 text-white/75">
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
