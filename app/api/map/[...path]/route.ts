import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleMapProxy(request, resolvedParams);
}

async function handleMapProxy(
  request: NextRequest,
  params: { path: string[] }
) {
  try {
    // Get cache type from request headers or cookies
    const cacheTypeHeader = request.headers.get('x-cache-type');
    const cacheTypeCookie = request.cookies.get('cache-type')?.value;
    
    // Default to environment variable if set, otherwise localhost
    let ip = 'localhost';
    let port = 8090;
    
    if (process.env.API_PROXY_DESTINATION) {
      try {
        const url = new URL(process.env.API_PROXY_DESTINATION);
        ip = url.hostname;
        port = parseInt(url.port || '8090');
      } catch (e) {
        // Invalid URL, use defaults
      }
    }

    if (cacheTypeHeader || cacheTypeCookie) {
      const cacheTypeStr = cacheTypeHeader || cacheTypeCookie;
      if (cacheTypeStr) {
        try {
          const cacheType = JSON.parse(cacheTypeStr);
          ip = cacheType.ip || ip;
          port = cacheType.port || port;
        } catch (e) {
          // Invalid JSON, use defaults
        }
      }
    }

    // Build the destination URL
    const path = params.path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const destination = `http://${ip}:${port}/map/${path}${searchParams ? `?${searchParams}` : ''}`;

    // Create abort controller for timeout
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;
    
    try {
      timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(destination, {
        method: 'GET',
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          host: `${ip}:${port}`,
        },
        signal: controller.signal,
      });
      
      if (timeoutId) clearTimeout(timeoutId);

      // Get response body
      const responseBody = await response.arrayBuffer();
      
      // Create new response with same status and headers
      const nextResponse = new NextResponse(responseBody, {
        status: response.status,
        statusText: response.statusText,
      });

      // Set no-cache headers to prevent caching
      nextResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      nextResponse.headers.set('Pragma', 'no-cache');
      nextResponse.headers.set('Expires', '0');

      // Copy relevant headers (but override cache headers)
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (!['content-encoding', 'transfer-encoding', 'cache-control', 'pragma', 'expires'].includes(lowerKey)) {
          nextResponse.headers.set(key, value);
        }
      });

      // Set content-type for JSON responses
      if (response.headers.get('content-type')?.includes('application/json')) {
        nextResponse.headers.set('Content-Type', 'application/json');
      }

      return nextResponse;
    } catch (fetchError: any) {
      // Clear timeout if it exists
      if (timeoutId) clearTimeout(timeoutId);
      
      // Handle connection errors gracefully
      const errorCode = fetchError?.code;
      const errorName = fetchError?.name;
      
      // Connection refused or timeout errors - return 503 Service Unavailable
      if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT' || errorName === 'AbortError') {
        return NextResponse.json(
          { error: 'Service unavailable', message: 'Map server is not responding' },
          { status: 503 }
        );
      }
      
      // For other errors, return 502 Bad Gateway
      return NextResponse.json(
        { error: 'Gateway error', message: fetchError instanceof Error ? fetchError.message : 'Unknown error' },
        { status: 502 }
      );
    }
  } catch (error) {
    // Handle any other unexpected errors
    console.error('Map proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


