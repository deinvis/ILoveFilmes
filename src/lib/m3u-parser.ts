
import type { MediaItem, MediaType } from '@/types';

const MAX_ITEMS_PER_PLAYLIST = 500; // Limite para não sobrecarregar
const VOD_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.mpeg', '.mpg'];

// Keywords for URL-based categorization (high priority)
const URL_STREAM_IS_CHANNEL_EXT = ['.ts'];
const URL_SERIES_KEYWORDS = ['/series/'];
const URL_MOVIE_KEYWORDS = ['/movies/', '/movie/'];

// Keywords for title-based categorization (second priority)
const TITLE_PPV_KEYWORDS = ['ppv'];

// Keywords for group-title based categorization (third priority)
const GROUP_MOVIE_KEYWORDS = ['movie', 'movies', 'filme', 'filmes', 'pelicula', 'peliculas', 'vod', 'filmes dublados', 'filmes legendados', 'lançamentos'];
const GROUP_SERIES_KEYWORDS = ['series', 'serie', 'série', 'séries', 'tvshow', 'tvshows', 'programa de tv', 'seriados', 'animes', 'anime'];
const GROUP_CHANNEL_KEYWORDS = ['canais', 'tv ao vivo', 'live tv', 'iptv channels', 'canal', 'esportes', 'noticias', 'infantil', 'documentarios', 'adulto'];

// Keywords for title-based VOD categorization (fourth priority, if stream is VOD)
const TITLE_SERIES_PATTERN = /S\d{1,2}E\d{1,2}|Season\s*\d+\s*Episode\s*\d+|Temporada\s*\d+\s*Epis[oó]dio\s*\d+/i;
const TITLE_MOVIE_KEYWORDS_GENERAL = ['movie', 'film', 'pelicula'];
const TITLE_SERIES_KEYWORDS_GENERAL = ['series', 'serie', 'série', 'tvshow'];

// General keywords for title-based categorization (fifth priority)
const GENERAL_TITLE_CHANNEL_KEYWORDS = ['live', 'tv', 'channel', 'canal', 'ao vivo'];


export function parseM3UContent(m3uString: string, playlistId: string, playlistName?: string): MediaItem[] {
  console.log(`Parsing M3U content for playlist ID: ${playlistId} (Name: ${playlistName || 'N/A'}). Item limit: ${MAX_ITEMS_PER_PLAYLIST}`);
  
  const lines = m3uString.split(/\r?\n/);
  const items: MediaItem[] = [];
  let currentRawItem: Record<string, any> = {};

  for (let i = 0; i < lines.length; i++) {
    if (items.length >= MAX_ITEMS_PER_PLAYLIST) {
      console.warn(`Reached MAX_ITEMS_PER_PLAYLIST (${MAX_ITEMS_PER_PLAYLIST}) for playlist ID: ${playlistId}. Stopping parsing for this playlist.`);
      break;
    }

    const line = lines[i].trim();

    if (line.startsWith('#EXTM3U')) {
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      currentRawItem = { originatingPlaylistId: playlistId, originatingPlaylistName: playlistName };
      const infoLineContent = line.substring(line.indexOf(':') + 1);

      const lastCommaIndex = infoLineContent.lastIndexOf(',');
      let attributesString = infoLineContent;
      let extinfTitle = '';

      if (lastCommaIndex !== -1) {
        attributesString = infoLineContent.substring(0, lastCommaIndex);
        extinfTitle = infoLineContent.substring(lastCommaIndex + 1).trim();
      } else {
        // If no comma, the whole string might be the title, or it might be attributes only
        // Check if it looks like attributes (contains '='). If not, assume it's the title.
        if (!attributesString.includes('=')) { 
            extinfTitle = attributesString;
            attributesString = ""; // No attributes
        }
        // If it contains '=', it means it's all attributes and no title after comma.
        // extinfTitle will remain empty, to be filled by tvg-name later.
      }

      currentRawItem.title = extinfTitle; // Initial title from after comma

      const attributeRegex = /(\S+?)="([^"]*)"/g;
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        const key = match[1].toLowerCase().replace(/-/g, ''); // Normalize key (e.g., tvg-id to tvgid)
        const value = match[2].trim();
        currentRawItem[key] = value;
      }
      
      // Prioritize tvg-name for title, then the #EXTINF title, then default
      if (currentRawItem.tvgname && currentRawItem.tvgname.trim() !== '') {
        currentRawItem.title = currentRawItem.tvgname.trim();
      } else if (currentRawItem.title && currentRawItem.title.trim() !== '') {
        // Already set from extinfTitle, ensure it's trimmed
        currentRawItem.title = currentRawItem.title.trim();
      } else {
        currentRawItem.title = 'Item Sem Título'; // Default if no title found
      }

      // Handle tvg-id (common variations)
      if (currentRawItem.tvgid && !currentRawItem.tvgId) { // tvg-id is sometimes tvgId in data
          currentRawItem.tvgId = currentRawItem.tvgid;
      }
      // Ensure tvgId is a string
      if (currentRawItem.tvgId && typeof currentRawItem.tvgId !== 'string') {
        currentRawItem.tvgId = String(currentRawItem.tvgId);
      }


      // Handle poster URL
      if (currentRawItem.tvglogo) {
        currentRawItem.posterUrl = currentRawItem.tvglogo;
      }

    } else if (line && !line.startsWith('#')) {
      // This line should be the stream URL
      if (currentRawItem.title ) { // Ensure we have a title before processing a URL
        const streamUrl = line;
        const {
          posterUrl,
          grouptitle, // raw group-title from M3U
          tvgId,      // EPG ID
          tvggenre,   // Specific genre from M3U
          originatingPlaylistId: itemOriginatingPlaylistId, // ID of the playlist this item belongs to
          originatingPlaylistName: itemOriginatingPlaylistName // Name of the playlist
        } = currentRawItem;

        const finalTitle = currentRawItem.title; // This is already prioritized (tvg-name or #EXTINF title)

        // Create a unique ID for the item, including playlist ID and its index within the file
        const itemIndexInFile = items.length; // Guarantees uniqueness within this specific parse run
        let semanticPart = tvgId || currentRawItem.tvgchno || finalTitle.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 30) || `item${itemIndexInFile}`;
        // Ensure semanticPart is not empty, especially if title was only symbols
        if (semanticPart.length === 0 || semanticPart.trim() === '') semanticPart = `item${itemIndexInFile}`; 
        
        const itemId = `${itemOriginatingPlaylistId}-${semanticPart}-${itemIndexInFile}`;

        let mediaType: MediaType;
        const lowerStreamUrl = streamUrl.toLowerCase();
        const lowerTitle = finalTitle.toLowerCase();
        const lowerGroupTitle = (grouptitle || '').toLowerCase();
        const isVODStreamByExtension = VOD_EXTENSIONS.some(ext => lowerStreamUrl.endsWith(ext));

        // MediaType Detection Logic (Prioritized)
        if (URL_STREAM_IS_CHANNEL_EXT.some(ext => lowerStreamUrl.endsWith(ext))) {
            mediaType = 'channel';
        } else if (URL_SERIES_KEYWORDS.some(keyword => lowerStreamUrl.includes(keyword))) {
            mediaType = 'series';
        } else if (URL_MOVIE_KEYWORDS.some(keyword => lowerStreamUrl.includes(keyword))) {
            mediaType = 'movie';
        } else if (TITLE_PPV_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
            mediaType = 'channel'; 
        } else if (GROUP_CHANNEL_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) {
          mediaType = 'channel';
        } else if (GROUP_MOVIE_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) {
          mediaType = 'movie';
        } else if (GROUP_SERIES_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) {
          mediaType = 'series';
        } else if (isVODStreamByExtension) {
          if (TITLE_SERIES_PATTERN.test(finalTitle) || TITLE_SERIES_KEYWORDS_GENERAL.some(keyword => lowerTitle.includes(keyword))) {
            mediaType = 'series';
          } else { // If VOD and not series pattern, assume movie
            mediaType = 'movie';
          }
        } else if (TITLE_SERIES_PATTERN.test(finalTitle) || TITLE_SERIES_KEYWORDS_GENERAL.some(keyword => lowerTitle.includes(keyword))) {
          mediaType = 'series';
        } else if (TITLE_MOVIE_KEYWORDS_GENERAL.some(keyword => lowerTitle.includes(keyword))) {
          mediaType = 'movie';
        } else if (GENERAL_TITLE_CHANNEL_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
          mediaType = 'channel';
        } else {
          // Default fallback if no other strong indicators
          mediaType = 'channel'; 
        }

        // Genre determination for VOD
        let finalGenre: string | undefined = undefined;
        if (mediaType === 'movie' || mediaType === 'series') {
            if (tvggenre && tvggenre.trim() !== '') {
                finalGenre = tvggenre.trim();
            } else if (grouptitle && grouptitle.trim() !== '' && !GROUP_CHANNEL_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword)) && !GROUP_SERIES_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword)) && !GROUP_MOVIE_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) { 
                // Use group-title as genre only if it doesn't look like a channel/series/movie main category itself
                // This is a heuristic and might need refinement based on playlist structures
                finalGenre = grouptitle.trim();
            }
        }

        const mediaItem: MediaItem = {
          id: itemId,
          type: mediaType,
          title: finalTitle,
          posterUrl: posterUrl, // Can be undefined
          streamUrl: streamUrl,
          groupTitle: grouptitle, // Store the raw group-title from M3U for grouping
          tvgId: tvgId, // EPG ID
          genre: finalGenre, // Specific genre, preferentially from tvg-genre
          description: currentRawItem.description || `Título: ${finalTitle}. Grupo: ${grouptitle || 'N/A'}. Tipo: ${mediaType}. Analisado da playlist: ${playlistName || playlistId}`,
          originatingPlaylistId: itemOriginatingPlaylistId,
          originatingPlaylistName: itemOriginatingPlaylistName,
        };
        items.push(mediaItem);
        currentRawItem = {}; // Reset for the next #EXTINF entry
      }
    }
  }
  console.log(`Parsed ${items.length} items for playlist ID: ${playlistId} (Name: ${playlistName || 'N/A'})`);
  return items;
}


export async function fetchAndParseM3UUrl(playlistUrl: string, playlistId: string, playlistName?: string): Promise<MediaItem[]> {
  console.log(`Fetching and parsing M3U via proxy for playlist ID: ${playlistId} (Name: ${playlistName || 'N/A'}), Original URL: ${playlistUrl}. Item limit: ${MAX_ITEMS_PER_PLAYLIST}`);
  let m3uString: string;
  const proxyApiUrl = `/api/proxy?url=${encodeURIComponent(playlistUrl)}`;

  try {
    const response = await fetch(proxyApiUrl);
    const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;
    
    let proxyErrorDetails = 'Não foi possível recuperar detalhes específicos do erro do proxy.';
    if (!response.ok) {
      try {
        const errorData = await response.json(); // Try to parse error from proxy as JSON
        if (errorData && typeof errorData.error === 'string') {
          proxyErrorDetails = errorData.error;
        } else if (errorData) { // If JSON but no .error string
          proxyErrorDetails = `Proxy retornou um formato de erro JSON inesperado: ${JSON.stringify(errorData)}`;
        }
      } catch (e) { 
        // If response is not JSON, try to get text
        try {
            const textError = await response.text();
            if (textError && textError.trim() !== '') {
                proxyErrorDetails = `Resposta do Proxy (não-JSON): ${textError.trim()}`;
            }
        } catch (textReadError) {
            // proxyErrorDetails remains as default
        }
      }

      let finalDetailedErrorMessage: string;
      if (response.status === 429) {
        finalDetailedErrorMessage = `O provedor da playlist em "${playlistUrl}" está limitando as requisições (HTTP 429 Too Many Requests). Isso significa que você tentou carregá-la muitas vezes em um curto período. Por favor, espere um pouco e tente novamente mais tarde. (Detalhes do proxy: ${proxyErrorDetails})`;
        console.warn(finalDetailedErrorMessage); // Changed to warn
      } else if (response.status === 503) {
         finalDetailedErrorMessage = `O provedor da playlist em "${playlistUrl}" está atualmente indisponível (HTTP 503 Service Unavailable). Isso geralmente significa que o servidor externo está temporariamente fora do ar ou sobrecarregado. Por favor, tente novamente mais tarde. (Detalhes do proxy: ${proxyErrorDetails})`;
         console.warn(finalDetailedErrorMessage); // Changed to warn
      } else {
        finalDetailedErrorMessage = `Falha ao buscar playlist via proxy (${upstreamStatusDescription}). Detalhes do proxy: ${proxyErrorDetails}. URL Original: ${playlistUrl}`;
        console.error(finalDetailedErrorMessage);
      }
      throw new Error(finalDetailedErrorMessage);
    }
    m3uString = await response.text();
  } catch (error: any) {
    // If the error is already one of our detailed messages, re-throw it
    if (error instanceof Error && (error.message.includes('O provedor da playlist em') || error.message.includes('Falha ao buscar playlist via proxy'))) {
        throw error; 
    }
    // Otherwise, wrap it as a generic proxy connection error
    const networkOrProxyError = `Erro ao conectar ao serviço de proxy interno da aplicação para ${playlistUrl}. Razão: ${error.message || 'Erro de fetch desconhecido'}. Verifique sua conexão de rede e se o proxy da aplicação está funcionando.`;
    console.error(networkOrProxyError, error);
    throw new Error(networkOrProxyError);
  }

  return parseM3UContent(m3uString, playlistId, playlistName);
}
