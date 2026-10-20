"use client";

import { useEffect, useState } from "react";

const SLIDES = [
  { src: "/marketing/truck.jpg", alt: "Work truck wrapped with a See your price in 30 seconds QR code" },
  { src: "/marketing/door-hanger.jpg", alt: "Door hanger with a scannable QR code: Curious what it costs to wash your home?" },
  { src: "/marketing/business-card.jpg", alt: "Business card with a QR code: Scan to get an instant price on your home" },
  { src: "/marketing/laptop.jpg", alt: "The instant-price quote page open on a laptop" },
];

const INTERVAL_MS = 4500;

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const count = SLIDES.length;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduceMotion(motion.matches);
    const syncHidden = () => setHidden(document.hidden);
    syncMotion();
    syncHidden();
    motion.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncHidden);
    return () => {
      motion.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncHidden);
    };
  }, []);

  useEffect(() => {
    if (hover || focusWithin || hidden || reduceMotion) return;
    const id = window.setInterval(() => setIndex((current) => (current + 1) % count), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [hover, focusWithin, hidden, reduceMotion, index, count]);

  function go(delta: number) {
    setIndex((current) => (current + delta + count) % count);
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
      }}
    >
      <div className="relative aspect-square overflow-hidden rounded-[1.75rem] bg-[#efeae3] shadow-xl ring-1 ring-black/5">
        {SLIDES.map((slide, i) => (
          <img
            key={slide.src}
            src={slide.src}
            alt={i === index ? slide.alt : ""}
            aria-hidden={i === index ? undefined : true}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === index ? "opacity-100" : "opacity-0"}`}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="rounded-full px-2 py-1 text-lg text-zinc-500 hover:bg-black/5 hover:text-zinc-900">
          ←
        </button>
        <div className="flex gap-2">
          {SLIDES.map((item, i) => (
            <button
              key={item.src}
              type="button"
              aria-label={`Go to image ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              className={`h-2.5 w-2.5 rounded-full ${i === index ? "bg-brand-700" : "bg-zinc-300 hover:bg-zinc-400"}`}
            />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} aria-label="Next image" className="rounded-full px-2 py-1 text-lg text-zinc-500 hover:bg-black/5 hover:text-zinc-900">
          →
        </button>
      </div>
    </div>
  );
}
