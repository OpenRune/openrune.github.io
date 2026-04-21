import { NextRequest, NextResponse } from "next/server";

type ShareEntry = {
  data: unknown;
  expires: number;
};

const shareStorage = new Map<string, ShareEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of shareStorage.entries()) {
    if (now > value.expires) {
      shareStorage.delete(key);
    }
  }
}, 60 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : null;
    const expires = typeof body?.expires === "number" ? body.expires : null;
    const data = body?.data;

    if (!id || !expires || !data) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    shareStorage.set(id, { data, expires });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to store share entry", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing share id." }, { status: 400 });
    }

    const entry = shareStorage.get(id);
    if (!entry) {
      return NextResponse.json({ error: "Share not found." }, { status: 404 });
    }

    if (Date.now() > entry.expires) {
      shareStorage.delete(id);
      return NextResponse.json({ error: "Share expired." }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Failed to fetch share entry", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
