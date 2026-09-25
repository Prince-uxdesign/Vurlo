import { Container } from "@/components/ui/container";
import { useCases } from "./content";
import { SectionHeading } from "./section-heading";

export function UseCasesSection() {
  return (
    <section
      id="use-cases"
      aria-labelledby="use-cases-title"
      className="scroll-mt-16 border-t border-(--color-border) py-14 md:py-20"
    >
      <Container>
        <SectionHeading
          id="use-cases-title"
          eyebrow="Use cases"
          title="Made for anyone who shares links."
        />
        <ul className="mt-10 grid gap-px overflow-hidden rounded-(--radius-lg) border border-(--color-ink-900) bg-(--color-ink-900) sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((item) => (
            <li key={item.title} className="flex flex-col bg-(--color-paper) p-5 md:p-6">
              <h3 className="text-h3">{item.title}</h3>
              <p className="mt-2 flex-1 text-(--color-muted)">{item.body}</p>
              <p className="mt-4 truncate font-mono text-[13px] font-medium">
                {item.example}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
