import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for share data (in production, use Redis or database)
const shareStorage = new Map<string, { data: any; expires: number }>();

// Cleanup expired entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of shareStorage.entries()) {
    if (now > entry.expires) {
      shareStorage.delete(id);
    }
  }
}, 60 * 60 * 1000); // Run every hour

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data, expires } = body;

    if (!id || !data || !expires) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Store the data
    shareStorage.set(id, { data, expires });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing share data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing share ID' }, { status: 400 });
    }

    const entry = shareStorage.get(id);
    
    if (!entry) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      shareStorage.delete(id);
      return NextResponse.json({ error: 'Share expired' }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error retrieving share data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 