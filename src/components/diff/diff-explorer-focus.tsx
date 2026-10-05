"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  clearFocusParam,
  DIFF_URL_PARAM_FOCUS,
  focusUrlToBracketTitle,
  writeFocusParam,
} from "./diff-focus-url";

type DiffExplorerFocusValue = {
  /** Bracket title to jump to, e.g. `[npc_15689]`. */
  focusBracketTitle: string | null;
  /** Bumps on each jump request so repeats of the same id still scroll. */
  focusNonce: number;
  requestFocus: (bracketTitle: string) => void;
  clearFocus: () => void;
};

const DiffExplorerFocusContext = React.createContext<DiffExplorerFocusValue>({
  focusBracketTitle: null,
  focusNonce: 0,
  requestFocus: () => {},
  clearFocus: () => {},
});

function replaceSearchParams(
  pathname: string,
  router: ReturnType<typeof useRouter>,
  mutate: (params: URLSearchParams) => void,
) {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const before = params.toString();
  mutate(params);
  const after = params.toString();
  if (before === after) return;
  router.replace(after ? `${pathname}?${after}` : pathname, { scroll: false });
}

export function DiffExplorerFocusProvider({ children }: { children: React.ReactNode }) {
  const [focusBracketTitle, setFocusBracketTitle] = React.useState<string | null>(null);
  const [focusNonce, setFocusNonce] = React.useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const focusParam = searchParams.get(DIFF_URL_PARAM_FOCUS);
  const lastUrlFocusRef = React.useRef<string | null>(null);

  const requestFocus = React.useCallback(
    (bracketTitle: string) => {
      const normalized = focusUrlToBracketTitle(bracketTitle);
      if (!normalized) return;
      setFocusBracketTitle(normalized);
      setFocusNonce((n) => n + 1);
      // Defer so section URL updates from search navigation land first.
      window.setTimeout(() => {
        replaceSearchParams(pathname, router, (params) => {
          writeFocusParam(params, normalized);
        });
      }, 0);
    },
    [pathname, router],
  );

  const clearFocus = React.useCallback(() => {
    lastUrlFocusRef.current = null;
    setFocusBracketTitle(null);
    replaceSearchParams(pathname, router, clearFocusParam);
  }, [pathname, router]);

  // URL → local focus (shared links / back-forward).
  React.useEffect(() => {
    const fromUrl = focusUrlToBracketTitle(focusParam);
    if (fromUrl === lastUrlFocusRef.current) return;
    lastUrlFocusRef.current = fromUrl;
    if (!fromUrl) {
      setFocusBracketTitle(null);
      return;
    }
    setFocusBracketTitle(fromUrl);
    setFocusNonce((n) => n + 1);
  }, [focusParam]);

  const value = React.useMemo(
    () => ({ focusBracketTitle, focusNonce, requestFocus, clearFocus }),
    [clearFocus, focusBracketTitle, focusNonce, requestFocus],
  );

  return (
    <DiffExplorerFocusContext.Provider value={value}>{children}</DiffExplorerFocusContext.Provider>
  );
}

export function useDiffExplorerFocus() {
  return React.useContext(DiffExplorerFocusContext);
}
