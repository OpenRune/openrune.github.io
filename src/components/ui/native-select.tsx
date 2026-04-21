"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const SELECT_CHEVRON_ICON =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236b7280%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")';

function NativeSelect({ className, style, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-9 w-full appearance-none rounded-md border border-border bg-background px-3 pr-8 text-sm text-foreground outline-none ring-ring/40 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      style={{
        backgroundImage: SELECT_CHEVRON_ICON,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.6rem center",
        backgroundSize: "1rem 1rem",
        ...style,
      }}
      {...props}
    />
  );
}

export { NativeSelect };
