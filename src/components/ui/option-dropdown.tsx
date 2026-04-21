"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

type Option = {
  value: string;
  label: string;
};

type OptionDropdownProps = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  buttonVariant?: VariantProps<typeof buttonVariants>["variant"];
  /** Menu width: `0` = match trigger only; default max(trigger, 140px). */
  menuMinWidthPx?: number;
  menuClassName?: string;
  ariaLabel?: string;
  /** Classes for the selected-label span (default truncates). */
  labelClassName?: string;
  /**
   * When true: clicking the label applies the current value (see `onAffirmPrimary`);
   * only the chevron opens/closes the menu.
   */
  splitAffirm?: boolean;
  /** With `splitAffirm`, runs when the label is clicked. Defaults to `onChange(value)`. */
  onAffirmPrimary?: () => void;
};

export function OptionDropdown({
  value,
  options,
  onChange,
  className,
  buttonClassName,
  buttonVariant = "outline",
  menuMinWidthPx,
  menuClassName,
  ariaLabel,
  labelClassName,
  splitAffirm = false,
  onAffirmPrimary,
}: OptionDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [, reposition] = React.useReducer((n: number) => n + 1, 0);

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const selectedLabel = React.useMemo(
    () => options.find((option) => option.value === value)?.label ?? value,
    [options, value],
  );

  const affirm = React.useCallback(() => {
    if (onAffirmPrimary) {
      onAffirmPrimary();
    } else {
      onChange(value);
    }
  }, [onAffirmPrimary, onChange, value]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, options]);

  React.useEffect(() => {
    if (!open) return;
    const onMove = () => reposition();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const menuNode = (() => {
    if (!mounted || !open || typeof document === "undefined") return null;
    const trigger = rootRef.current?.getBoundingClientRect();
    if (!trigger) return null;

    const menuH = menuRef.current?.offsetHeight || 120;
    const spaceBelow = window.innerHeight - trigger.bottom;
    const openUpward = spaceBelow < menuH + 8 && trigger.top > spaceBelow;
    const top = openUpward ? trigger.top - menuH - 4 : trigger.bottom + 4;

    const menuWidth =
      menuMinWidthPx === 0 ? trigger.width : Math.max(trigger.width, menuMinWidthPx ?? 140);

    return (
      <div
        ref={menuRef}
        className={`fixed z-[200] rounded-lg border bg-popover shadow-lg ${menuClassName ?? ""}`.trim()}
        style={{
          left: trigger.left,
          top,
          width: menuWidth,
        }}
      >
        <div className="max-h-72 space-y-1 overflow-auto p-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${option.value === value ? "bg-muted font-medium" : ""}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  })();

  if (splitAffirm) {
    return (
      <div className={cn("relative", className)}>
        <div
          ref={rootRef}
          role="group"
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn(
            buttonVariants({ variant: buttonVariant }),
            "flex w-full min-w-0 items-stretch gap-0 overflow-hidden p-0 text-sm shadow-none [&_svg]:pointer-events-none",
            buttonClassName,
          )}
        >
          <button
            type="button"
            className={cn(
              "inline-flex min-h-0 min-w-0 flex-1 cursor-pointer items-center px-2 py-0 text-left outline-none",
              "hover:bg-muted/50 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/50",
              "dark:hover:bg-muted/35",
            )}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              affirm();
            }}
            aria-label={ariaLabel ? `${ariaLabel}: use ${selectedLabel}` : `Use ${selectedLabel}`}
          >
            <span className={cn("min-w-0", labelClassName ?? "truncate")}>{selectedLabel}</span>
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center justify-center border-l border-border/60 px-1.5 outline-none",
              "hover:bg-muted/50 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/50",
              "dark:hover:bg-muted/35",
            )}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((prev) => !prev);
            }}
            aria-label={ariaLabel ? `${ariaLabel}: open choices` : "Open choices"}
            aria-haspopup="listbox"
          >
            <ChevronDown className="size-3.5 shrink-0 opacity-80" aria-hidden />
          </button>
        </div>

        {menuNode ? createPortal(menuNode, document.body) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant={buttonVariant}
        className={cn("h-9 w-full justify-between gap-1.5 px-2 text-sm", buttonClassName)}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}: ${selectedLabel}` : undefined}
      >
        <span className={cn("min-w-0", labelClassName ?? "truncate")}>{selectedLabel}</span>
        <ChevronDown className="size-3.5 shrink-0" aria-hidden />
      </Button>

      {menuNode ? createPortal(menuNode, document.body) : null}
    </div>
  );
}
