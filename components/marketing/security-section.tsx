import { EyeOff, Flag, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { trustPoints } from "./content";
import { SectionHeading } from "./section-heading";

const icons = [UserCheck, Lock, EyeOff, Flag, ShieldCheck];

export function SecuritySection() {
  return (
    <section
      id="trust"
      aria-labelledby="trust-title"
      className="scroll-mt-16 border-y border-(--color-border) bg-(--color-mist-100) py-14 md:py-20"
    >
      <Container>
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <SectionHeading
              id="trust-title"
              eyebrow="Trust"
              title="Links you can stand behind."
            >
              How Vurlo protects your links and your data. Advanced URL
              reputation checks are not part of this release.
            </SectionHeading>
          </div>
          {trustPoints.map((point, index) => {
            const Icon = icons[index] ?? ShieldCheck;
            return (
              <div
                key={point.title}
                className={
                  index === 4
                    ? "sm:col-span-2 sm:mx-auto sm:w-full sm:max-w-md lg:col-span-1 lg:mx-0 lg:max-w-none"
                    : undefined
                }
              >
                <Icon size={22} aria-hidden="true" />
                <h3 className="text-h3 mt-3">{point.title}</h3>
                <p className="mt-1.5 text-(--color-muted)">{point.body}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
