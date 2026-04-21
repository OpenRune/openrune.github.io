import { NextResponse } from "next/server";

import { getCacheArchiveRows } from "@/lib/openrs2";

export async function GET() {
  try {
    const rows = await getCacheArchiveRows();
    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        total: rows.length,
        rows,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch cache archive data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
