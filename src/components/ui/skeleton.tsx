import * as React from "react";

import { cn } from "@/lib/utils";

type SkeletonProps = React.ComponentProps<"div"> & {
  /** Stagger entrance (e.g. grid index × 28). */
  delayMs?: number;
  /** Soft fade + ease on mount (default true). */
  fadeIn?: boolean;
  /** Moving highlight across the bar (default true). */
  shimmer?: boolean;
};

function Skeleton({
  className,
  delayMs = 0,
  fadeIn = true,
  shimmer = true,
  style,
  ...props
}: SkeletonProps) {
  const delay = `${delayMs}ms`;
  const shimmerDelay = `${delayMs + 220}ms`;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/90",
        fadeIn && "opacity-0 skeleton-ui-enter",
        className,
      )}
      style={{
        animationDelay: fadeIn ? delay : undefined,
        ...style,
      }}
      {...props}
    >
      {shimmer ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-[110%] max-w-[18rem] -translate-x-full",
            "bg-gradient-to-r from-transparent from-10% via-foreground/18 to-transparent to-90%",
            "dark:via-white/22",
            "skeleton-ui-shimmer",
          )}
          style={{ animationDelay: shimmerDelay }}
        />
      ) : null}
    </div>
  );
}

export { Skeleton };
