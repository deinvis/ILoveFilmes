
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playlistUrl = searchParams.get('url');

  if (!playlistUrl) {
    return NextResponse.json({ error: 'Playlist URL is required' }, { status: 400 });
  }

  try {
    const decodedPlaylistUrl = decodeURIComponent(playlistUrl);

    const response = await fetch(decodedPlaylistUrl, {
      headers: {
        'User-Agent': 'StreamVerse/1.0 (Next.js Proxy)',
        'Accept': '*/*', 
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;
      
      let proxyGeneratedError = `Failed to fetch from upstream server (${upstreamStatusDescription}).`;
      if (errorText && errorText.trim() !== '') {
        proxyGeneratedError += ` Details: ${errorText.trim()}`;
      } else {
        proxyGeneratedError += ` The upstream server returned an error but provided no further details.`;
      }
      
      console.error(`Proxy: Failed to fetch ${decodedPlaylistUrl}: ${upstreamStatusDescription}. Upstream error body: ${errorText.trim()}`);
      return NextResponse.json({ error: proxyGeneratedError }, { status: response.status });
    }

    const m3uString = await response.text();
    
    let contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl; charset=utf-8'; // Default to a common M3U type
    if (!contentType.includes('charset')) {
        contentType += '; charset=utf-8';
    }
    
    return new NextResponse(m3uString, {
      status: 200,
      headers: {
        'Content-Type': contentType,
      },
    });

  } catch (error: any) {
    console.error(`Proxy: Error fetching playlist ${playlistUrl}:`, error);
    let errorMessage = `Internal server error while trying to fetch the playlist via proxy.`;
    if (error.message) {
        errorMessage += ` Reason: ${error.message}`;
    }
    if (error.cause) { 
        errorMessage += ` Cause: ${String(error.cause)}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
