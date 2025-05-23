
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playlistUrl = searchParams.get('url');

  if (!playlistUrl) {
    return NextResponse.json({ error: 'Playlist URL is required' }, { status: 400 });
  }

  try {
    // Attempt to decode the URL, in case it was double-encoded or contains entities
    const decodedPlaylistUrl = decodeURIComponent(playlistUrl);

    const response = await fetch(decodedPlaylistUrl, {
      headers: {
        // Some servers might require a specific User-Agent
        'User-Agent': 'StreamVerse/1.0 (Next.js Proxy)',
        'Accept': '*/*', // Be liberal with accept types
      },
      // It's good to have a timeout for external requests
      // Note: timeout is not a standard fetch option, needs AbortController for robust implementation
      // For simplicity, we'll rely on default timeouts or server-level timeouts for now.
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Proxy: Failed to fetch ${decodedPlaylistUrl}: ${response.status} ${response.statusText}. Upstream error: ${errorText}`);
      return NextResponse.json({ error: `Failed to fetch from upstream server (${response.status} ${response.statusText}). Details: ${errorText}` }, { status: response.status });
    }

    const m3uString = await response.text();
    
    // Determine content type, default to text/plain
    let contentType = response.headers.get('content-type') || 'text/plain; charset=utf-8';
    if (!contentType.includes('charset')) {
        contentType += '; charset=utf-8'; // Ensure charset for text-based M3U
    }
    // Common M3U content types: 'application/vnd.apple.mpegurl', 'audio/mpegurl', 'application/x-mpegURL'
    // If the upstream provides a specific M3U type, use it. Otherwise, generic text is fine for parsing.

    return new NextResponse(m3uString, {
      status: 200,
      headers: {
        'Content-Type': contentType,
      },
    });

  } catch (error: any) {
    console.error(`Proxy: Error fetching playlist ${playlistUrl}:`, error);
    // Distinguish between network errors and other errors
    let errorMessage = `Internal server error while trying to fetch the playlist via proxy.`;
    if (error.message) {
        errorMessage += ` Reason: ${error.message}`;
    }
    if (error.cause) { // Node.js fetch might include a 'cause' for network errors
        errorMessage += ` Cause: ${String(error.cause)}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
