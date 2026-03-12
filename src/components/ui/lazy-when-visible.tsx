"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type LazyWhenVisibleProps = {
  children: React.ReactNode;
  /** Passed to IntersectionObserver (null = viewport). */
  root?: Element | null;
  /** Extra margin so nearby off-screen content mounts before scroll settles. */
  rootMargin?: string;
  className?: string;
  /** Placeholder until the observer fires; should match layout to limit CLS. */
  fallback?: React.ReactNode;
  /** Use `span` when this must sit inside phrasing content (e.g. next to text). */
  as?: "div" | "span";
};

/**
 * Renders `children` only after the wrapper intersects the observer root.
 * Disconnects after first hit so remounting children does not re-subscribe.
 */
export function LazyWhenVisible({
  children,
  root = null,
  rootMargin = "160px",
  className,
  fallback,
  as = "div",
}: LazyWhenVisibleProps) {
  const divRef = React.useRef<HTMLDivElement | null>(null);
  const spanRef = React.useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const el = as === "span" ? spanRef.current : divRef.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { root, rootMargin, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, root, rootMargin, as]);

  const placeholder =
    fallback ??
    (as === "span" ? (
      <span className="inline-block size-full min-h-[inherit] rounded-[inherit] bg-muted/25" aria-hidden />
    ) : (
      <div className="size-full min-h-[inherit] rounded-[inherit] bg-muted/25" aria-hidden />
    ));

  if (as === "span") {
    return (
      <span ref={spanRef} className={cn("inline-block", className)}>
        {shown ? children : placeholder}
      </span>
    );
  }

  return (
    <div ref={divRef} className={cn(className)}>
      {shown ? children : placeholder}
    </div>
  );
}
