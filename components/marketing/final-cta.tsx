import { Container } from "@/components/ui/container";
import { CreateLinkCta } from "./create-link-cta";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="pb-14 md:pb-20">
      <Container>
        <div className="flex flex-col gap-6 rounded-(--radius-lg) border-[1.5px] border-(--color-ink-900) bg-white p-6 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-xl">
            <h2
              id="cta-title"
              className="text-[26px] font-bold leading-tight tracking-tight md:text-[34px]"
            >
              Ready to make your links simpler?
            </h2>
            <p className="mt-2 text-(--color-muted)">
              Paste a URL and get a short link in seconds.
            </p>
          </div>
          <CreateLinkCta className="md:flex-none">Create a short link</CreateLinkCta>
        </div>
      </Container>
    </section>
  );
}
