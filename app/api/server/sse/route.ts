import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Get the SSE event type from query parameters (optional - if not provided, backend will return all events)
  const type = request.nextUrl.searchParams.get('type');

  // Get cache type from query parameters first (for multiple simultaneous connections),
  // then fall back to headers/cookies, then environment variable, then defaults
  let ip = 'localhost';
  let port = 8090;
  
  // Check query parameters first (allows multiple connections to different backends)
  const queryIp = request.nextUrl.searchParams.get('ip');
  const queryPort = request.nextUrl.searchParams.get('port');
  
  if (queryIp && queryPort) {
    ip = queryIp;
    port = parseInt(queryPort);
  } else {
    // Fall back to cache type from headers or cookies
    const cacheTypeHeader = request.headers.get('x-cache-type');
    const cacheTypeCookie = request.cookies.get('cache-type')?.value;
    
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
    
    // Fall back to environment variable if no cache type found
    if ((!cacheTypeHeader && !cacheTypeCookie) && process.env.API_PROXY_DESTINATION) {
      try {
        const url = new URL(process.env.API_PROXY_DESTINATION);
        ip = url.hostname;
        port = parseInt(url.port || '8090');
      } catch (e) {
        // Invalid URL, use defaults
      }
    }
  }

  // Build the destination URL - use HTTP for the backend (Ktor server)
  // Forward all query parameters except ip and port (which are used for routing)
  const queryParams = new URLSearchParams();
  if (type) {
    queryParams.set('type', type);
  }
  
  // Forward all other query parameters (like jobId for ZIP_PROGRESS)
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== 'ip' && key !== 'port' && key !== 'type') {
      queryParams.set(key, value);
    }
  });
  
  const queryString = queryParams.toString();
  const destination = `http://${ip}:${port}/sse${queryString ? `?${queryString}` : ''}`;

  try {
    // Create a streaming response for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch(destination, {
            method: 'GET',
            headers: {
              // Forward relevant headers
              'Accept': 'text/event-stream',
              'Cache-Control': 'no-cache',
            },
          });

          if (!response.ok) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: 'Failed to connect to SSE endpoint', status: response.status })}\n\n`)
            );
            controller.close();
            return;
          }

          // Stream the response body
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                controller.close();
                break;
              }

              // Forward the chunk to the client
              controller.enqueue(value);
            }
          } catch (streamError) {
            console.error('SSE stream error:', streamError);
            controller.close();
          }
        } catch (fetchError: any) {
          console.error('SSE proxy error:', fetchError);
          
          // Handle connection errors gracefully
          const errorCode = fetchError?.code;
          const errorName = fetchError?.name;
          
          if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT' || errorName === 'AbortError') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: 'Service unavailable', message: 'Cache server is not responding' })}\n\n`)
            );
          } else {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: 'Gateway error', message: fetchError instanceof Error ? fetchError.message : 'Unknown error' })}\n\n`)
            );
          }
          
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering in nginx
      },
    });
  } catch (error) {
    console.error('SSE proxy setup error:', error);
    return new Response(
      JSON.stringify({
        error: 'Proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

