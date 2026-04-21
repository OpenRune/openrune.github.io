"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";

type PerPageDropdownProps = {
  value: number;
  options: readonly number[];
  onChange: (value: number) => void;
  className?: string;
};

export function PerPageDropdown({ value, options, onChange, className }: PerPageDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [openUpward, setOpenUpward] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!rootRef.current || !target || rootRef.current.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  React.useLayoutEffect(() => {
    if (!open || !rootRef.current || !menuRef.current) return;

    const updatePlacement = () => {
      if (!rootRef.current || !menuRef.current) return;
      const triggerRect = rootRef.current.getBoundingClientRect();
      const menuHeight = menuRef.current.offsetHeight;
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      const shouldOpenUpward = spaceBelow < menuHeight + 8 && spaceAbove > spaceBelow;
      setOpenUpward(shouldOpenUpward);
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, options.length]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`.trim()}>
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

      {open ? (
        <div
          ref={menuRef}
          className={`absolute right-0 z-50 w-28 rounded-lg border bg-popover shadow-lg ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <div className="space-y-1 p-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === value}
                className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${option === value ? "bg-muted font-medium" : ""}`}
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
      ) : null}
    </div>
  );
}
