import type * as React from "react";

/**
 * When settings request uppercase gamevals on copy, replace the clipboard payload
 * with the uppercase of the current text selection (native copy / Ctrl+C).
 */
export function onCopyApplyGamevalUppercaseSetting(
  e: React.ClipboardEvent,
  copyGamevalsToUppercase: boolean,
): void {
  if (!copyGamevalsToUppercase) return;
  if (typeof window === "undefined") return;
  const sel = window.getSelection()?.toString() ?? "";
  if (!sel) return;
  e.preventDefault();
  e.clipboardData.setData("text/plain", sel.toUpperCase());
}
