
import type { MediaItem, MediaType } from '@/types';

export async function parseM3U(playlistUrl: string, playlistId: string): Promise<MediaItem[]> {
  console.log(`Fetching and parsing M3U via proxy for playlist ID: ${playlistId}, Original URL: ${playlistUrl}`);
  let m3uString: string;
  // Construct the URL for our internal proxy API route
  const proxyApiUrl = `/api/proxy?url=${encodeURIComponent(playlistUrl)}`;

  try {
    const response = await fetch(proxyApiUrl);
    if (!response.ok) {
      let errorData;
      try {
        // The proxy should return JSON for errors
        errorData = await response.json();
      } catch (e) {
        // Fallback if the error response from the proxy isn't JSON
        errorData = { error: await response.text() };
      }
      const detailedErrorMessage = `Failed to fetch playlist via proxy (${response.status} ${response.statusText}). Proxy error: ${errorData.error || 'Unknown error from proxy'}. Original URL: ${playlistUrl}`;
      console.error(detailedErrorMessage);
      throw new Error(detailedErrorMessage);
    }
    m3uString = await response.text();
  } catch (error: any) {
    // This catch block handles network errors to the proxy itself,
    // or re-throws the specific error constructed above if the proxy responded with an error.
    console.error(`Error during fetch or processing for proxied URL ${proxyApiUrl} (Original: ${playlistUrl}):`, error.message);
    // If it's a generic "Failed to fetch" to our own proxy, it might indicate the Next.js server itself has issues.
    if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
         throw new Error(`Network error connecting to the application's internal proxy service while attempting to fetch ${playlistUrl}. Reason: ${error.message}.`);
    }
    throw error; // Re-throw the error (could be the specific one from the try block or a new one)
  }

  const lines = m3uString.split(/\r?\n/);
  const items: MediaItem[] = [];
  let currentRawItem: Record<string, any> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTM3U')) {
      continue; // Standard M3U header
    }

    if (line.startsWith('#EXTINF:')) {
      currentRawItem = { originatingPlaylistId: playlistId }; // Store for unique ID generation context
      const infoLineContent = line.substring(line.indexOf(':') + 1);
      
      const lastCommaIndex = infoLineContent.lastIndexOf(',');
      let attributesString = infoLineContent;
      let extinfTitle = '';

      if (lastCommaIndex !== -1) {
        attributesString = infoLineContent.substring(0, lastCommaIndex);
        extinfTitle = infoLineContent.substring(lastCommaIndex + 1).trim();
      } else {
        // If no comma, the whole string after ':' might be attributes or just a duration.
      }
      
      currentRawItem.title = extinfTitle; 

      const attributeRegex = /(\S+?)="([^"]*)"/g;
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        const key = match[1].toLowerCase().replace(/-/g, ''); // Normalize key: tvg-id -> tvgid
        const value = match[2].trim();
        currentRawItem[key] = value;
      }

      // Prioritize tvg-name for title if available
      if (currentRawItem.tvgname && currentRawItem.tvgname.trim() !== '') {
        currentRawItem.title = currentRawItem.tvgname;
      }
      
      if (currentRawItem.tvglogo) {
        currentRawItem.posterUrl = currentRawItem.tvglogo;
      }
      
      if (currentRawItem.grouptitle) {
        currentRawItem.groupTitle = currentRawItem.grouptitle;
      }

    } else if (line && !line.startsWith('#')) {
      // This line is the stream URL
      if (currentRawItem.title || currentRawItem.tvgname) { 
        const streamUrl = line;
        const { 
          title = 'Untitled', 
          posterUrl, 
          groupTitle, 
          tvgid, 
          tvgchno, 
          originatingPlaylistId 
        } = currentRawItem;

        // Ensure title is not empty string before using it for ID generation
        const finalTitle = (title && title.trim() !== '') ? title.trim() : (currentRawItem.tvgname && currentRawItem.tvgname.trim() !== '' ? currentRawItem.tvgname.trim() : 'Untitled Item');

        const baseIdSource = tvgid || tvgchno || finalTitle.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 50) || `item${items.length}`;
        const itemId = `${originatingPlaylistId}-${baseIdSource}`;

        let mediaType: MediaType = 'channel';
        const lowerGroupTitle = groupTitle?.toLowerCase() || '';
        const lowerTitle = finalTitle.toLowerCase(); // Use finalTitle for type detection too

        if (lowerGroupTitle.includes('movie') || lowerGroupTitle.includes('filme') || lowerTitle.includes('movie') || lowerTitle.includes('filme')) {
          mediaType = 'movie';
        } else if (lowerGroupTitle.includes('serie') || lowerGroupTitle.includes('série') || lowerGroupTitle.includes('series') || lowerTitle.includes('series') ) {
          mediaType = 'series';
        }
        
        let finalPosterUrl = posterUrl;
        if (!finalPosterUrl || finalPosterUrl.trim() === '') {
            const dataAiHint = mediaType === 'movie' ? 'movie poster' : mediaType === 'series' ? 'tv series' : 'tv broadcast';
            finalPosterUrl = `https://placehold.co/300x450.png?hint=${encodeURIComponent(dataAiHint)}`;
        }

        const mediaItem: MediaItem = {
          id: itemId,
          type: mediaType,
          title: finalTitle,
          posterUrl: finalPosterUrl,
          streamUrl: streamUrl,
          groupTitle: groupTitle,
          genre: (mediaType === 'movie' || mediaType === 'series') && groupTitle ? groupTitle : undefined,
          description: `Title: ${finalTitle}. Group: ${groupTitle || 'N/A'}.`,
        };
        items.push(mediaItem);
        currentRawItem = {}; 
      }
    }
  }
  console.log(`Parsed ${items.length} items from original URL: ${playlistUrl} (via proxy)`);
  return items;
}
