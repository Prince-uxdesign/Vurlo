import { Container } from "@/components/ui/container";
import { benefits } from "./content";
import { LinkRowsPanel } from "./link-rows-panel";
import { SectionHeading } from "./section-heading";

export function BenefitsSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-16 border-t border-(--color-border) py-14 md:py-20"
    >
      <Container>
        <SectionHeading
          id="features-title"
          eyebrow="Why Vurlo"
          title="Simple to create. Powerful to manage. Useful after the click."
        />
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-14">
          <ul className="border-t border-(--color-ink-900)">
            {benefits.map((benefit) => (
              <li
                key={benefit.title}
                className="grid gap-1 border-b border-(--color-border) py-5 sm:grid-cols-[200px_1fr] sm:gap-6"
              >
                <h3 className="text-h3">{benefit.title}</h3>
                <p className="text-(--color-muted)">{benefit.body}</p>
              </li>
            ))}
          </ul>
          <div className="mx-auto w-full max-w-xl lg:max-w-none lg:sticky lg:top-24 lg:self-start">
            <LinkRowsPanel />
          </div>
        </div>
      </Container>
    </section>
  );
}
