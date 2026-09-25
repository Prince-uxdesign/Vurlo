import { Container } from "@/components/ui/container";
import { ShortenerWidget } from "./shortener/shortener-widget";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="pb-14 pt-8 md:pb-20 md:pt-14">
      <Container className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:gap-x-14 lg:gap-y-6">
        <div className="w-full max-w-xl mx-auto lg:max-w-none lg:self-end">
          <h1
            id="hero-title"
            className="text-[32px] sm:text-[40px] md:text-[50px] lg:text-[54px] xl:text-[60px] font-bold leading-[1.1] tracking-tight"
          >
            Short links that{" "}
            <span className="whitespace-nowrap text-(--color-ember-700)">
              do more.
            </span>
          </h1>
          <p className="text-[15px] sm:text-[16px] md:text-body-l mt-3 md:mt-4 max-w-xl text-(--color-muted)">
            Shorten a URL, choose your own alias, and see who clicks. Vurlo
            keeps your links tidy and useful after you share them.
          </p>
        </div>

        <div className="w-full max-w-xl mx-auto lg:max-w-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <ShortenerWidget />
          <p className="text-small mt-3 text-(--color-muted)">
            No account needed to create a link.
          </p>
        </div>

        <div className="w-full max-w-xl mx-auto lg:max-w-none lg:col-start-1 lg:row-start-2 lg:self-start">
          <a href="#features" className="btn-secondary">
            Explore features
          </a>
        </div>
      </Container>
    </section>
  );
}
