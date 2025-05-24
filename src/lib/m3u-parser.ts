
import type { MediaItem, MediaType } from '@/types';
import { extractChannelInfo } from '@/lib/channel-name-utils';

const MAX_ITEMS_PER_PLAYLIST = 5000; // Reverted to 5000 as per earlier user request, adjust if needed
const VOD_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.mpeg', '.mpg'];

// Keywords for URL-based categorization (highest priority)
const URL_STREAM_IS_CHANNEL_EXT = ['.ts'];
// Removed anime specific URL keywords
const URL_SERIES_KEYWORDS = ['/series/'];
const URL_MOVIE_KEYWORDS = ['/movies/', '/movie/'];

// Keywords for title-based categorization (second priority)
const TITLE_PPV_KEYWORDS = ['ppv'];

// Keywords for group-title based categorization (third priority)
const GROUP_MOVIE_KEYWORDS = ['movie', 'movies', 'filme', 'filmes', 'pelicula', 'peliculas', 'vod', 'filmes dublados', 'filmes legendados', 'lançamentos'];
const GROUP_SERIES_KEYWORDS = ['series', 'serie', 'série', 'séries', 'tvshow', 'tvshows', 'programa de tv', 'seriados'];
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
        if (!attributesString.includes('=')) {
            extinfTitle = attributesString.split(',').pop()?.trim() || attributesString.trim();
            attributesString = "";
        }
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
        // currentRawItem.title is already set from extinfTitle
      } else {
        currentRawItem.title = 'Item Sem Título';
      }

      if (currentRawItem.tvgid && !currentRawItem.tvgId) {
          currentRawItem.tvgId = currentRawItem.tvgid;
      }
      if (currentRawItem.tvgId && typeof currentRawItem.tvgId !== 'string') {
        currentRawItem.tvgId = String(currentRawItem.tvgId);
      }


      if (currentRawItem.tvglogo) {
        currentRawItem.posterUrl = currentRawItem.tvglogo;
      }
      if (currentRawItem.catchuptype && currentRawItem.catchuptype === 'default' && currentRawItem.catchupsource) {
        currentRawItem.description = (currentRawItem.description || '') + `\nCatchup Source: ${currentRawItem.catchupsource}`;
      }


    } else if (line && !line.startsWith('#')) {
      if (currentRawItem.title ) {
        const streamUrl = line;
        const {
          posterUrl,
          grouptitle, // raw group title from m3u
          tvgId,
          tvggenre,
          originatingPlaylistId: itemOriginatingPlaylistId,
          originatingPlaylistName: itemOriginatingPlaylistName
        } = currentRawItem;

        const fullTitle = currentRawItem.title;
        const { baseName, qualityTag } = extractChannelInfo(fullTitle);

        const itemIndexInFile = items.length;
        let semanticPart = tvgId || baseName.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 30) || `item${itemIndexInFile}`;
        if (semanticPart.length === 0 || semanticPart.trim() === '') semanticPart = `item${itemIndexInFile}`;
        const itemId = `${itemOriginatingPlaylistId}-${semanticPart}-${itemIndexInFile}`;

        let mediaType: MediaType;
        const lowerStreamUrl = streamUrl.toLowerCase();
        const lowerFullTitle = fullTitle.toLowerCase();
        const lowerGroupTitle = (grouptitle || '').toLowerCase();
        // const lowerTvGenre = (tvggenre || '').toLowerCase(); // Not used in anime removal

        const isVODStreamByExtension = VOD_EXTENSIONS.some(ext => lowerStreamUrl.endsWith(ext));

        // MediaType Detection Logic (Prioritized)
        if (URL_STREAM_IS_CHANNEL_EXT.some(ext => lowerStreamUrl.endsWith(ext))) {
            mediaType = 'channel';
        } else if (TITLE_PPV_KEYWORDS.some(keyword => lowerFullTitle.includes(keyword))) {
            mediaType = 'channel';
        } else if (URL_SERIES_KEYWORDS.some(keyword => lowerStreamUrl.includes(keyword))) {
            mediaType = 'series';
        } else if (URL_MOVIE_KEYWORDS.some(keyword => lowerStreamUrl.includes(keyword))) {
            mediaType = 'movie';
        } else if (GROUP_CHANNEL_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) {
          mediaType = 'channel';
        } else {
          // No anime detection here anymore
          if (GROUP_SERIES_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) {
            mediaType = 'series';
          } else if (GROUP_MOVIE_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) {
            mediaType = 'movie';
          } else if (isVODStreamByExtension) {
            if (TITLE_SERIES_PATTERN.test(fullTitle) || TITLE_SERIES_KEYWORDS_GENERAL.some(keyword => lowerFullTitle.includes(keyword))) {
              mediaType = 'series';
            } else {
              mediaType = 'movie';
            }
          } else if (TITLE_SERIES_PATTERN.test(fullTitle) || TITLE_SERIES_KEYWORDS_GENERAL.some(keyword => lowerFullTitle.includes(keyword))) {
            mediaType = 'series';
          } else if (TITLE_MOVIE_KEYWORDS_GENERAL.some(keyword => lowerFullTitle.includes(keyword))) {
            mediaType = 'movie';
          } else if (GENERAL_TITLE_CHANNEL_KEYWORDS.some(keyword => lowerFullTitle.includes(keyword))) {
            mediaType = 'channel';
          } else {
            mediaType = qualityTag || !isVODStreamByExtension ? 'channel' : 'movie';
          }
        }

        let finalGenre: string | undefined = undefined;
        if (mediaType === 'movie' || mediaType === 'series') { // Removed anime
            if (tvggenre && tvggenre.trim() !== '') {
                finalGenre = tvggenre.trim();
            } else if (grouptitle && grouptitle.trim() !== '' && !GROUP_CHANNEL_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword)) ) {
                finalGenre = grouptitle.trim();
            }
        }


        const mediaItem: MediaItem = {
          id: itemId,
          type: mediaType,
          title: fullTitle,
          baseName: baseName,
          qualityTag: qualityTag,
          posterUrl: posterUrl,
          streamUrl: streamUrl,
          groupTitle: grouptitle,
          tvgId: tvgId,
          genre: finalGenre,
          description: currentRawItem.description || `Título: ${fullTitle}. Grupo: ${grouptitle || 'N/A'}. Tipo: ${mediaType}. Qualidade: ${qualityTag || 'N/A'}.`,
          originatingPlaylistId: itemOriginatingPlaylistId,
          originatingPlaylistName: itemOriginatingPlaylistName,
        };
        items.push(mediaItem);
        currentRawItem = {};
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
            const errorData = await response.json(); 
            if (errorData && typeof errorData.error === 'string') {
                 proxyErrorDetails = errorData.error;
            } else if (errorData) { 
                proxyErrorDetails = `Proxy retornou um formato de erro JSON inesperado: ${JSON.stringify(errorData)}`;
            }
        } catch (e) {
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
        finalDetailedErrorMessage = `O provedor da playlist em "${playlistUrl}" está limitando as requisições (HTTP 429 Too Many Requests). Isso significa que você tentou carregá-la muitas vezes em um curto período. Por favor, espere um pouco e tente novamente mais tarde. (Proxy message: ${proxyErrorDetails})`;
        console.warn(finalDetailedErrorMessage);
      } else if (response.status === 503) {
         finalDetailedErrorMessage = `O provedor da playlist em "${playlistUrl}" está atualmente indisponível (HTTP 503 Service Unavailable). Isso geralmente significa que o servidor externo está temporariamente fora do ar ou sobrecarregado. Por favor, tente novamente mais tarde. (Detalhes do proxy: ${proxyErrorDetails})`;
         console.warn(finalDetailedErrorMessage);
      } else {
        finalDetailedErrorMessage = `Falha ao buscar playlist via proxy (${upstreamStatusDescription}). Detalhes do proxy: ${proxyErrorDetails}. URL Original: ${playlistUrl}`;
        console.error(finalDetailedErrorMessage);
      }
      throw new Error(finalDetailedErrorMessage);
    }
    m3uString = await response.text();
  } catch (error: any) {
    if (error instanceof Error && (error.message.includes('O provedor da playlist em') || error.message.includes('Falha ao buscar playlist via proxy'))) {
        throw error; 
    }
    const networkOrProxyError = `Erro ao conectar ao serviço de proxy interno da aplicação para ${playlistUrl}. Razão: ${error.message || 'Erro de fetch desconhecido'}. Verifique sua conexão de rede e se o proxy da aplicação está funcionando.`;
    console.error(networkOrProxyError, error);
    throw new Error(networkOrProxyError);
  }

  return parseM3UContent(m3uString, playlistId, playlistName);
}
