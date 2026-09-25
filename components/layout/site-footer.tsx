import { Container } from "@/components/ui/container";

/** Footer shell — warm dark surface per the design system. */
export function SiteFooter() {
  return (
    <footer className="bg-(--color-surface-dark) text-white">
      <Container className="flex flex-col gap-2 py-8 md:flex-row md:items-center md:justify-between">
        <span className="text-h3">Vurlo</span>
        <p className="text-small opacity-70">
          Simple to create. Powerful to manage.
        </p>
      </Container>
    </footer>
  );
}
