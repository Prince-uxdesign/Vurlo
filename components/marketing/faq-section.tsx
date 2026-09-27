import { ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/container";
import { faqs } from "./content";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

/** Native <details> gives keyboard + screen-reader behavior with no JS runtime overhead. */
export function FaqSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-16 py-16 md:py-24"
    >
      <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-(--color-mist-300) bg-white px-3 py-1 text-[12px] font-semibold text-(--color-slate-700)">
            <span className="size-2 rounded-full bg-(--color-ink-900)" />
            Common questions
          </span>
          <h2
            id="faq-title"
            className="mt-4 text-[30px] font-bold leading-tight tracking-tight sm:text-[38px] md:text-[44px] text-(--color-ink-900)"
          >
            Clear answers to common questions.
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-(--color-slate-700)">
            Everything you need to know about link shortening, custom aliases, QR
            codes, and privacy-first analytics on Vurlo.
          </p>
        </div>

        <div className="border-t border-(--color-ink-900)">
          {faqs.map((item) => (
            <details
              key={item.question}
              className="group border-b border-(--color-mist-300) transition-colors"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-bold text-(--color-ink-900) [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <ChevronDown
                  size={19}
                  aria-hidden="true"
                  className="flex-none text-(--color-slate-700) transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <p className="pb-6 pr-8 text-[15px] leading-relaxed text-(--color-slate-700)">
                {item.answer}
              </p>
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
