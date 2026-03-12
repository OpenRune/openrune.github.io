import Link from "next/link";
import { ArrowRight, Database, Globe, GitCompareArrows, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBinarySize, formatDateTime, formatNumber } from "@/lib/formatting";
import { getCurrentRevisionSnapshot } from "@/lib/openrs2";

const FEATURE_CARDS = [
  {
    title: "Configs / Diff",
    description:
      "Compare and inspect cache config changes quickly with shared revision targeting.",
    icon: GitCompareArrows,
    href: "/diff/full",
    buttonLabel: "Open Diff",
  },
  {
    title: "Color Helper",
    description:
      "Convert packed Jagex HSL values, inspect bit fields, and test visual output.",
    icon: Sparkles,
    href: "/colors",
    buttonLabel: "Open Color Helper",
  },
  {
    title: "API Endpoints",
    description:
      "Build URLs, run test calls, and inspect payloads directly in-app.",
    icon: Globe,
    href: "/api-docs",
    buttonLabel: "Open API Endpoints",
  },
  {
    title: "Cache Data",
    description:
      "Revision cards use live OpenRS2 data and refresh automatically via server caching.",
    icon: Database,
    href: "/cache-type",
    buttonLabel: "Open Cache Type",
  },
] as const;

export default async function HomePage() {
  const revisions = await getCurrentRevisionSnapshot().catch(() => null);
  const oldschool = revisions?.oldschool ?? null;
  const runescape = revisions?.runescape ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-3">
          <Badge variant="outline" className="w-fit">
            OpenRune
          </Badge>
          <CardTitle className="text-3xl tracking-tight sm:text-4xl">
            RuneScape tooling, one clean workspace
          </CardTitle>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Quick utilities for configs, diffs, colors, API exploration, and more.
            Use the sidebar to jump in, or start with one of the tools below.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          <Button render={<Link href="/diff/full" />} size="sm">
            Open Diff
            <ArrowRight className="size-4" />
          </Button>
          <Button variant="outline" render={<Link href="/colors" />} size="sm">
            Open Color Helper
          </Button>
          <Button variant="outline" render={<Link href="/api-docs" />} size="sm">
            Open API Endpoints
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href={
            oldschool
              ? `/cache-archive?game=oldschool&id=${oldschool.archiveId}&open=1`
              : "/cache-archive?game=oldschool"
          }
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Card className="h-full transition-colors hover:bg-muted/30">
            <CardHeader className="space-y-2 pb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">OLDSCHOOL</Badge>
                <span className="text-xs text-muted-foreground">Live cache revision</span>
              </div>
              <CardTitle className="text-xl">
                {oldschool ? `Rev ${formatNumber(oldschool.revision)}` : "Unavailable"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {oldschool ? (
                <>
                  <p>
                    Sub-revision: <span className="text-foreground">{oldschool.subRevision}</span>
                  </p>
                  <p>
                    Archive ID: <span className="text-foreground">{oldschool.archiveId}</span>
                  </p>
                  <p>
                    Size: <span className="text-foreground">{formatBinarySize(oldschool.size)}</span>
                  </p>
                  <p>
                    Last cache timestamp:{" "}
                    <span className="text-foreground">{formatDateTime(oldschool.timestamp)}</span>
                  </p>
                </>
              ) : (
                <p>Could not fetch current OldSchool revision from OpenRS2.</p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link
          href={
            runescape
              ? `/cache-archive?game=runescape&id=${runescape.archiveId}&open=1`
              : "/cache-archive?game=runescape"
          }
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Card className="h-full transition-colors hover:bg-muted/30">
            <CardHeader className="space-y-2 pb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">RUNESCAPE</Badge>
                <span className="text-xs text-muted-foreground">Live cache revision</span>
              </div>
              <CardTitle className="text-xl">
                {runescape ? `Rev ${formatNumber(runescape.revision)}` : "Unavailable"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {runescape ? (
                <>
                  <p>
                    Sub-revision: <span className="text-foreground">{runescape.subRevision}</span>
                  </p>
                  <p>
                    Archive ID: <span className="text-foreground">{runescape.archiveId}</span>
                  </p>
                  <p>
                    Size: <span className="text-foreground">{formatBinarySize(runescape.size)}</span>
                  </p>
                  <p>
                    Last cache timestamp:{" "}
                    <span className="text-foreground">{formatDateTime(runescape.timestamp)}</span>
                  </p>
                </>
              ) : (
                <p>Could not fetch current RuneScape revision from OpenRS2.</p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURE_CARDS.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title} className="flex min-h-48 flex-col bg-muted/20 shadow-none">
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2 text-foreground">
                  <div className="rounded-md border border-border bg-background p-1.5">
                    <Icon className="size-4" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  render={<Link href={feature.href} />}
                >
                  {feature.buttonLabel}
                  <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
