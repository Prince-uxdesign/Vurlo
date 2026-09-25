import { ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/container";
import { faqs } from "./content";
import { SectionHeading } from "./section-heading";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

/** Native <details> gives keyboard + screen-reader behavior with no JS. */
export function FaqSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-16 py-14 md:py-20"
    >
      <Container className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-16">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions, answered." />
        <div className="border-t border-(--color-ink-900)">
          {faqs.map((item) => (
            <details key={item.question} className="group border-b border-(--color-border)">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  size={20}
                  aria-hidden="true"
                  className="flex-none transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pb-5 pr-8 text-(--color-muted)">{item.answer}</p>
            </details>
          ))}
        </div>
      </Container>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </section>
  );
}
