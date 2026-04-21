"use client";

import { CacheTypeSelectorCard } from "@/components/cache-type-selector-card";

export default function CacheTypeSelectorPage() {
  return (
    <div className="mx-auto flex min-h-[65vh] w-full max-w-6xl flex-col items-center gap-8 pt-10 pb-8 px-4 sm:pt-14 sm:px-8">
      <CacheTypeSelectorCard className="max-w-3xl" />
    </div>
  );
}
