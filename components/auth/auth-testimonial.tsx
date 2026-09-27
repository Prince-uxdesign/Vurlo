"use client";

import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import { useState } from "react";

export interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
  company: string;
  rating?: number;
}

const FALLBACK_TESTIMONIAL: TestimonialItem = {
  quote:
    "We move 10x faster than our peers and stay consistent. While they’re bogged down with messy URLs, we’re releasing branded links with instant insights.",
  author: "Sophie Hall",
  role: "Founder, Catalog",
  company: "Web Design Agency",
  rating: 5,
};

const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  FALLBACK_TESTIMONIAL,
  {
    quote:
      "Vurlo replaced three different tools for our creative agency. Clean links, reliable QR codes, and our clients love the transparent stats.",
    author: "Eleni Rostova",
    role: "Head of Product",
    company: "Studio North",
    rating: 5,
  },
  {
    quote:
      "The sub-10ms redirects and privacy-first analytics gave us the exact speed and trust our multi-channel campaigns demanded.",
    author: "Marcus Chen",
    role: "Growth Director",
    company: "Apex Media",
    rating: 5,
  },
];

interface AuthTestimonialProps {
  items?: TestimonialItem[];
  defaultIndex?: number;
}

export function AuthTestimonial({
  items = DEFAULT_TESTIMONIALS,
  defaultIndex = 0,
}: AuthTestimonialProps) {
  const safeItems = items.length > 0 ? items : DEFAULT_TESTIMONIALS;
  const [index, setIndex] = useState(defaultIndex);

  const safeIndex = ((index % safeItems.length) + safeItems.length) % safeItems.length;
  const current: TestimonialItem = safeItems[safeIndex] ?? FALLBACK_TESTIMONIAL;

  function handlePrev() {
    setIndex((prev) => prev - 1);
  }

  function handleNext() {
    setIndex((prev) => prev + 1);
  }

  return (
    <div className="relative z-10 w-full p-8 md:p-12 lg:p-14 xl:p-16">
      {/* Testimonial Quote */}
      <blockquote className="min-h-[110px]">
        <p className="text-[22px] font-medium leading-snug tracking-tight text-white transition-all duration-300 sm:text-[24px] xl:text-[28px]">
          &ldquo;{current.quote}&rdquo;
        </p>
      </blockquote>

      {/* Author Details, Star Rating & Navigation Controls */}
      <div className="mt-8 flex items-end justify-between gap-4 border-t border-white/15 pt-6">
        <div>
          <p className="text-[17px] font-bold text-white tracking-tight">
            {current.author}
          </p>
          <p className="text-[14px] text-white/80">
            {current.role}
          </p>
          <p className="text-[13px] text-white/60">
            {current.company}
          </p>

          {/* 5 Stars Rating */}
          <div
            className="mt-3 flex items-center gap-1 text-amber-400"
            aria-label={`${current.rating || 5} out of 5 stars`}
          >
            {Array.from({ length: current.rating || 5 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                fill="currentColor"
                strokeWidth={0}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        {/* Carousel Navigation Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous testimonial"
            className="flex size-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-xs transition-all hover:bg-white/25 active:scale-95"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next testimonial"
            className="flex size-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-xs transition-all hover:bg-white/25 active:scale-95"
          >
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
