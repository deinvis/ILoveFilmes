
import type { MediaItem, MediaType } from '@/types';

export async function parseM3U(playlistUrl: string, playlistId: string): Promise<MediaItem[]> {
  console.log(`Fetching and parsing M3U for playlist ID: ${playlistId}, URL: ${playlistUrl}`);
  let m3uString: string;
  try {
    // Add a timestamp to try and bypass cache if needed, though server should handle caching.
    const cacheBustingUrl = `${playlistUrl}${playlistUrl.includes('?') ? '&' : '?'}timestamp=${new Date().getTime()}`;
    const response = await fetch(cacheBustingUrl);
    if (!response.ok) {
      console.error(`Failed to fetch playlist ${playlistUrl}: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch playlist (${response.status} ${response.statusText})`);
    }
    m3uString = await response.text();
  } catch (error: any) {
    console.error(`Error fetching playlist ${playlistUrl}:`, error); // Logs the original error to the console
    let detailedMessage = `Failed to fetch playlist from ${playlistUrl}. Reason: ${error.message}.`;
    if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
      detailedMessage += ' This can be due to network issues, an invalid URL, or Cross-Origin Resource Sharing (CORS) restrictions on the server. If running in a browser, check the developer console for more specific error details (e.g., CORS errors).';
    }
    throw new Error(detailedMessage); // Re-throw with a more informative message
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
        // For simplicity, assume if no comma, it might just be duration or title is missing.
      }
      
      currentRawItem.title = extinfTitle; 

      const attributeRegex = /(\S+?)="([^"]*)"/g;
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        const key = match[1].toLowerCase().replace(/-/g, ''); // Normalize key: tvg-id -> tvgid
        const value = match[2].trim();
        currentRawItem[key] = value;
      }

      if (currentRawItem.tvgname) {
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
          tvgchno, // Channel number, can be useful
          originatingPlaylistId 
        } = currentRawItem;

        const baseIdSource = tvgid || tvgchno || title.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 50) || `item${items.length}`;
        const itemId = `${originatingPlaylistId}-${baseIdSource}`;

        let mediaType: MediaType = 'channel';
        const lowerGroupTitle = groupTitle?.toLowerCase() || '';
        const lowerTitle = title?.toLowerCase() || '';

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
          title: title,
          posterUrl: finalPosterUrl,
          streamUrl: streamUrl,
          groupTitle: groupTitle,
          genre: (mediaType === 'movie' || mediaType === 'series') && groupTitle ? groupTitle : undefined,
          description: `Title: ${title}. Group: ${groupTitle || 'N/A'}.`,
        };
        items.push(mediaItem);
        currentRawItem = {}; 
      }
    }
  }
  console.log(`Parsed ${items.length} items from ${playlistUrl}`);
  return items;
}
