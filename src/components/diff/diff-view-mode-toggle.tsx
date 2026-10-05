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
  /** Mode to use when the URL carries no `view=`. */
  defaultValue?: "text" | "table";
  className?: string;
};

export function DiffViewModeToggle<V extends string>({
  value,
  onChange,
  options,
  defaultValue = "text",
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

  /** `?view=` pins the mode; with no param the caller's default applies. */
  const urlValue = React.useMemo(() => {
    const param = searchParams.get("view");
    if (param === "table") return tableOptionValue;
    if (param === "text") return textOptionValue;
    return defaultValue === "table" ? tableOptionValue : textOptionValue;
  }, [defaultValue, searchParams, tableOptionValue, textOptionValue]);

  React.useEffect(() => {
    if (textOptionValue == null || tableOptionValue == null || urlValue == null) return;
    if (value !== urlValue) onChange(urlValue);
  }, [onChange, tableOptionValue, textOptionValue, urlValue, value]);

  const handleModeChange = React.useCallback(
    (next: V) => {
      onChange(next);

      if (textOptionValue == null || tableOptionValue == null) return;

      const params = new URLSearchParams(searchParams.toString());
      // Only the non-default mode needs a param, so the common URL stays clean.
      const nextName = next === tableOptionValue ? "table" : "text";
      if (nextName === defaultValue) {
        params.delete("view");
      } else {
        params.set("view", nextName);
      }

      const nextQs = params.toString();
      const nextHref = nextQs ? `${pathname}?${nextQs}` : pathname;
      router.replace(nextHref, { scroll: false });
    },
    [defaultValue, onChange, pathname, router, searchParams, tableOptionValue, textOptionValue],
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
