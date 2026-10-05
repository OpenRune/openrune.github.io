"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PerPageDropdownProps = {
  value: number;
  options: readonly number[];
  onChange: (value: number) => void;
  className?: string;
};

export function PerPageDropdown({ value, options, onChange, className }: PerPageDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [, reposition] = React.useReducer((n: number) => n + 1, 0);

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, options.length]);

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

    return (
      <div
        ref={menuRef}
        className="fixed z-[300] w-28 rounded-lg border bg-popover shadow-lg"
        style={{
          left: trigger.right - 112,
          top,
        }}
      >
        <div className="space-y-1 p-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              className={cn(
                "w-full rounded px-2 py-1 text-left text-sm hover:bg-muted",
                option === value && "bg-muted font-medium",
              )}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  })();

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        className="h-8 gap-1.5 px-2 text-xs"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {value}
        <ChevronDown className="size-3.5" />
      </Button>

      {menuNode ? createPortal(menuNode, document.body) : null}
    </div>
  );
}
