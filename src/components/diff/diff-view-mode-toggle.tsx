"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export type DiffViewModeOption<V extends string = string> = {
  value: V;
  label: string;
};

export type DiffViewModeToggleProps<V extends string> = {
  value: V;
  onChange: (value: V) => void;
  options: readonly DiffViewModeOption<V>[];
  className?: string;
};

export function DiffViewModeToggle<V extends string>({
  value,
  onChange,
  options,
  className,
}: DiffViewModeToggleProps<V>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const textOptionValue = React.useMemo(
    () => options.find((opt) => String(opt.value) === "text")?.value,
    [options],
  );
  const tableOptionValue = React.useMemo(
    () => options.find((opt) => String(opt.value) === "table")?.value,
    [options],
  );

  React.useEffect(() => {
    if (textOptionValue == null || tableOptionValue == null) return;
    const target = searchParams.get("view") === "text" ? textOptionValue : tableOptionValue;
    if (value !== target) {
      onChange(target);
    }
  }, [onChange, searchParams, tableOptionValue, textOptionValue, value]);

  const handleModeChange = React.useCallback(
    (next: V) => {
      onChange(next);

      if (textOptionValue == null || tableOptionValue == null) return;

      const params = new URLSearchParams(searchParams.toString());
      if (next === textOptionValue) {
        params.set("view", "text");
      } else {
        params.delete("view");
      }

      const nextQs = params.toString();
      const nextHref = nextQs ? `${pathname}?${nextQs}` : pathname;
      router.replace(nextHref, { scroll: false });
    },
    [onChange, pathname, router, searchParams, tableOptionValue, textOptionValue],
  );

  return (
    <div className={cn("flex rounded-lg border bg-muted/50 p-1", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => handleModeChange(opt.value)}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-colors",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
