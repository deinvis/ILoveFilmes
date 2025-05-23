
import type { MediaItem, MediaType } from '@/types';

export async function parseM3U(playlistUrl: string, playlistId: string): Promise<MediaItem[]> {
  console.log(`Fetching and parsing M3U via proxy for playlist ID: ${playlistId}, Original URL: ${playlistUrl}`);
  let m3uString: string;
  const proxyApiUrl = `/api/proxy?url=${encodeURIComponent(playlistUrl)}`;

  try {
    const response = await fetch(proxyApiUrl); // This is the response from *our* proxy.

    if (!response.ok) {
      let proxyErrorDetails = 'Could not retrieve specific error details from proxy.';
      try {
        const errorData = await response.json();
        if (errorData && typeof errorData.error === 'string') {
          proxyErrorDetails = errorData.error;
        } else if (errorData) {
          proxyErrorDetails = `Proxy returned an unexpected JSON error format: ${JSON.stringify(errorData)}`;
        }
      } catch (e) {
        // This means our proxy didn't send valid JSON, or there was another issue reading the error.
        // Try to get plain text if JSON parsing failed.
        try {
            const textError = await response.text(); // Attempt to read as text.
            if (textError && textError.trim() !== '') {
                proxyErrorDetails = `Proxy response (non-JSON): ${textError.trim()}`;
            } else {
                proxyErrorDetails = 'Proxy did not return a JSON response, and the error body was empty or unreadable.';
            }
        } catch (textReadError) {
            proxyErrorDetails = 'Proxy did not return a JSON response, and attempting to read its body as text also failed.';
        }
      }

      let finalDetailedErrorMessage: string;
      const statusTextDisplay = response.statusText ? ` ${response.statusText.trim()}` : '';

      if (response.status === 429) {
        finalDetailedErrorMessage = `The playlist provider at "${playlistUrl}" is rate-limiting requests (HTTP 429 Too Many Requests). This means you've tried to load it too many times in a short period. Please wait a while and try again later. (Proxy message: ${proxyErrorDetails})`;
      } else {
        finalDetailedErrorMessage = `Failed to fetch playlist via proxy (HTTP ${response.status}${statusTextDisplay}). Details from proxy: ${proxyErrorDetails}. Original URL: ${playlistUrl}`;
      }
      console.error(finalDetailedErrorMessage);
      throw new Error(finalDetailedErrorMessage);
    }
    m3uString = await response.text();
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('The playlist provider at')) {
        // Re-throw the specific 429 error or other already processed error.
        throw error;
    }
    // Handle network errors to the proxy itself, or other unexpected errors during the fetch to the proxy.
    const networkOrProxyError = `Error connecting to the application's internal proxy service for ${playlistUrl}. Reason: ${error.message || 'Unknown fetch error'}.`;
    console.error(networkOrProxyError, error);
    throw new Error(networkOrProxyError);
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
      currentRawItem = { originatingPlaylistId: playlistId }; 
      const infoLineContent = line.substring(line.indexOf(':') + 1);
      
      const lastCommaIndex = infoLineContent.lastIndexOf(',');
      let attributesString = infoLineContent;
      let extinfTitle = '';

      if (lastCommaIndex !== -1) {
        attributesString = infoLineContent.substring(0, lastCommaIndex);
        extinfTitle = infoLineContent.substring(lastCommaIndex + 1).trim();
      }
      
      currentRawItem.title = extinfTitle; 

      const attributeRegex = /(\S+?)="([^"]*)"/g;
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        const key = match[1].toLowerCase().replace(/-/g, ''); 
        const value = match[2].trim();
        currentRawItem[key] = value;
      }

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

        const finalTitle = (title && title.trim() !== '') ? title.trim() : (currentRawItem.tvgname && currentRawItem.tvgname.trim() !== '' ? currentRawItem.tvgname.trim() : 'Untitled Item');

        const baseIdSource = tvgid || tvgchno || finalTitle.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 50) || `item${items.length}`;
        const itemId = `${originatingPlaylistId}-${baseIdSource}`;

        let mediaType: MediaType = 'channel';
        const lowerGroupTitle = groupTitle?.toLowerCase() || '';
        const lowerTitle = finalTitle.toLowerCase();

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
