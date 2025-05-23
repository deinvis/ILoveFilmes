
import type { MediaItem, MediaType } from '@/types';

const MAX_ITEMS_PER_PLAYLIST = 100; 
const VOD_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.mpeg', '.mpg', '.ts'];
const SERIES_PATTERN = /S\d{1,2}E\d{1,2}|Season\s*\d+\s*Episode\s*\d+|Temporada\s*\d+\s*Epis[oó]dio\s*\d+/i;
const MOVIE_KEYWORDS = ['movie', 'movies', 'filme', 'filmes', 'pelicula', 'peliculas', 'vod', 'filmes dublados', 'filmes legendados'];
const SERIES_KEYWORDS = ['series', 'serie', 'série', 'séries', 'tvshow', 'tvshows', 'programa de tv', 'seriados', 'animes'];
const CHANNEL_KEYWORDS_IN_GROUP = ['canais', 'tv ao vivo', 'live tv', 'iptv channels', 'canal'];


export async function parseM3U(playlistUrl: string, playlistId: string): Promise<MediaItem[]> {
  console.log(`Fetching and parsing M3U via proxy for playlist ID: ${playlistId}, Original URL: ${playlistUrl}. Max items: ${MAX_ITEMS_PER_PLAYLIST}`);
  let m3uString: string;
  const proxyApiUrl = `/api/proxy?url=${encodeURIComponent(playlistUrl)}`;

  try {
    const response = await fetch(proxyApiUrl); 

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
        try {
            const textError = await response.text(); 
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
      const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;

      if (response.status === 429) {
        finalDetailedErrorMessage = `The playlist provider at "${playlistUrl}" is rate-limiting requests (HTTP 429 Too Many Requests). This means you've tried to load it too many times in a short period. Please wait a while and try again later. (Proxy message: ${proxyErrorDetails})`;
      } else if (response.status === 503) {
        finalDetailedErrorMessage = `The playlist provider at "${playlistUrl}" is currently unavailable (HTTP 503 Service Unavailable). This usually means the external server is temporarily down or overloaded. Please try again later. (Proxy details: ${proxyErrorDetails})`;
      }
       else {
        finalDetailedErrorMessage = `Failed to fetch playlist via proxy (${upstreamStatusDescription}). Details from proxy: ${proxyErrorDetails}. Original URL: ${playlistUrl}`;
      }
      console.error(finalDetailedErrorMessage);
      throw new Error(finalDetailedErrorMessage);
    }
    m3uString = await response.text();
  } catch (error: any) {
    if (error instanceof Error && (error.message.startsWith('The playlist provider at') || error.message.startsWith('Failed to fetch playlist via proxy'))) {
        throw error;
    }
    const networkOrProxyError = `Error connecting to the application's internal proxy service for ${playlistUrl}. Reason: ${error.message || 'Unknown fetch error'}.`;
    console.error(networkOrProxyError, error);
    throw new Error(networkOrProxyError);
  }

  const lines = m3uString.split(/\r?\n/);
  const items: MediaItem[] = [];
  let currentRawItem: Record<string, any> = {};

  for (let i = 0; i < lines.length; i++) {
    if (items.length >= MAX_ITEMS_PER_PLAYLIST) {
      console.log(`Reached MAX_ITEMS_PER_PLAYLIST (${MAX_ITEMS_PER_PLAYLIST}) for playlist ID: ${playlistId}. Stopping parse for this playlist.`);
      break;
    }

    const line = lines[i].trim();

    if (line.startsWith('#EXTM3U')) {
      continue; 
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
        currentRawItem.title = currentRawItem.tvgname.trim();
      } else if (currentRawItem.title && currentRawItem.title.trim() !== '') {
        currentRawItem.title = currentRawItem.title.trim();
      } else {
        currentRawItem.title = 'Untitled Item';
      }
      
      if (currentRawItem.tvglogo) {
        currentRawItem.posterUrl = currentRawItem.tvglogo;
      }
      
      if (currentRawItem.grouptitle) {
        currentRawItem.groupTitle = currentRawItem.grouptitle;
      }

    } else if (line && !line.startsWith('#')) { 
      if (currentRawItem.title ) { 
        const streamUrl = line;
        const { 
          posterUrl, 
          groupTitle, 
          tvgid, 
          tvgchno, 
          originatingPlaylistId
        } = currentRawItem;

        const finalTitle = currentRawItem.title; 

        const itemIndexInFile = items.length; 
        let semanticPart = tvgid || tvgchno || finalTitle.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 30) || `item${itemIndexInFile}`;
        const itemId = `${originatingPlaylistId}-${semanticPart}-${itemIndexInFile}`;

        let mediaType: MediaType = 'channel'; 
        const lowerGroupTitle = (groupTitle || '').toLowerCase();
        const lowerTitle = finalTitle.toLowerCase();
        const lowerStreamUrl = streamUrl.toLowerCase();

        if (CHANNEL_KEYWORDS_IN_GROUP.some(keyword => lowerGroupTitle.includes(keyword))) {
          mediaType = 'channel';
        } else if (MOVIE_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) {
          mediaType = 'movie';
        } else if (SERIES_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) {
          mediaType = 'series';
        } else {
          const isVODStreamByExtension = VOD_EXTENSIONS.some(ext => lowerStreamUrl.endsWith(ext));

          if (isVODStreamByExtension) {
            if (SERIES_PATTERN.test(finalTitle) || SERIES_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
              mediaType = 'series';
            } else if (MOVIE_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
              mediaType = 'movie';
            } else {
              mediaType = 'movie';
            }
          } else {
            if (SERIES_PATTERN.test(finalTitle) || SERIES_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
               mediaType = 'series';
            } else if (MOVIE_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
               mediaType = 'movie';
            } else {
               mediaType = 'channel'; 
            }
          }
        }
        
        const mediaItem: MediaItem = {
          id: itemId,
          type: mediaType,
          title: finalTitle,
          posterUrl: posterUrl, 
          streamUrl: streamUrl,
          groupTitle: groupTitle,
          genre: (mediaType === 'movie' || mediaType === 'series') && groupTitle ? groupTitle : undefined,
          description: `Title: ${finalTitle}. Group: ${groupTitle || 'N/A'}. Type: ${mediaType}. Parsed from playlist: ${playlistId}`,
        };
        items.push(mediaItem);
        currentRawItem = {}; 
      }
    }
  }
  console.log(`Parsed ${items.length} items (up to ${MAX_ITEMS_PER_PLAYLIST} max) from original URL: ${playlistUrl} (via proxy for playlistId: ${playlistId})`);
  return items;
}

