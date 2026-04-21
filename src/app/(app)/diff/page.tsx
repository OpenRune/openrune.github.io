import { redirect } from "next/navigation";

import {
  DIFF_ROUTE_FULL,
  DIFF_URL_PARAM_BASE,
  DIFF_URL_PARAM_COMPARE,
  DIFF_URL_PARAM_FROM,
  DIFF_URL_PARAM_REV,
  DIFF_URL_PARAM_SECTION,
  DIFF_URL_PARAM_TO,
} from "@/components/diff/diff-constants";

function pickParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length > 0) return v[0];
  return undefined;
}

export default async function DiffIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  const rev = pickParam(sp[DIFF_URL_PARAM_REV]);
  const base = pickParam(sp[DIFF_URL_PARAM_BASE]) ?? pickParam(sp[DIFF_URL_PARAM_FROM]);
  const compare = pickParam(sp[DIFF_URL_PARAM_COMPARE]) ?? pickParam(sp[DIFF_URL_PARAM_TO]);
  const tab = pickParam(sp[DIFF_URL_PARAM_SECTION]);
  if (rev != null && rev !== "") p.set(DIFF_URL_PARAM_REV, rev);
  if (base != null && base !== "") p.set(DIFF_URL_PARAM_BASE, base);
  if (compare != null && compare !== "") p.set(DIFF_URL_PARAM_COMPARE, compare);
  if (tab != null && tab !== "") p.set(DIFF_URL_PARAM_SECTION, tab);
  const q = p.toString();
  redirect(q ? `${DIFF_ROUTE_FULL}?${q}` : DIFF_ROUTE_FULL);
}
