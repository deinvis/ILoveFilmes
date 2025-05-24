
import type { MediaItem, MediaType } from '@/types';

const MAX_ITEMS_PER_PLAYLIST = 100; // Adjusted for more content
const VOD_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.mpeg', '.mpg'];
const SERIES_PATTERN = /S\d{1,2}E\d{1,2}|Season\s*\d+\s*Episode\s*\d+|Temporada\s*\d+\s*Epis[oó]dio\s*\d+/i;

// Keywords for group-title based categorization
const GROUP_MOVIE_KEYWORDS = ['movie', 'movies', 'filme', 'filmes', 'pelicula', 'peliculas', 'vod', 'filmes dublados', 'filmes legendados'];
const GROUP_SERIES_KEYWORDS = ['series', 'serie', 'série', 'séries', 'tvshow', 'tvshows', 'programa de tv', 'seriados', 'animes'];
const GROUP_CHANNEL_KEYWORDS = ['canais', 'tv ao vivo', 'live tv', 'iptv channels', 'canal'];

// Keywords for title-based categorization (lower priority)
const TITLE_MOVIE_KEYWORDS = ['movie', 'film', 'pelicula'];
const TITLE_SERIES_KEYWORDS = ['series', 'serie', 'série', 'tvshow', 'season', 'episode', 'temporada', 'episodio', 'anime']; // 'serie' is a bit broad here, but kept for now
const GENERAL_TITLE_CHANNEL_KEYWORDS = ['live', 'tv', 'channel', 'canal'];


export async function parseM3U(playlistUrl: string, playlistId: string, playlistName?: string): Promise<MediaItem[]> {
  console.log(`Buscando e analisando M3U via proxy para playlist ID: ${playlistId} (Nome: ${playlistName || 'N/A'}), URL Original: ${playlistUrl}. Limite de itens: ${MAX_ITEMS_PER_PLAYLIST}`);
  let m3uString: string;
  const proxyApiUrl = `/api/proxy?url=${encodeURIComponent(playlistUrl)}`;

  try {
    const response = await fetch(proxyApiUrl);

    if (!response.ok) {
      let proxyErrorDetails = 'Não foi possível recuperar detalhes específicos do erro do proxy.';
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
            } else {
                proxyErrorDetails = 'Proxy não retornou uma resposta JSON, e o corpo do erro estava vazio ou ilegível.';
            }
        } catch (textReadError) {
            proxyErrorDetails = 'Proxy não retornou uma resposta JSON, e tentar ler seu corpo como texto também falhou.';
        }
      }

      let finalDetailedErrorMessage: string;
      const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;

      if (response.status === 429) {
        finalDetailedErrorMessage = `O provedor da playlist em "${playlistUrl}" está limitando as requisições (HTTP 429 Too Many Requests). Isso significa que você tentou carregá-la muitas vezes em um curto período. Por favor, espere um pouco e tente novamente mais tarde. (Mensagem do proxy: ${proxyErrorDetails})`;
      } else if (response.status === 503) {
         finalDetailedErrorMessage = `O provedor da playlist em "${playlistUrl}" está atualmente indisponível (HTTP 503 Service Unavailable). Isso geralmente significa que o servidor externo está temporariamente fora do ar ou sobrecarregado. Por favor, tente novamente mais tarde. (Detalhes do proxy: ${proxyErrorDetails})`;
      } else {
        finalDetailedErrorMessage = `Falha ao buscar playlist via proxy (${upstreamStatusDescription}). Detalhes do proxy: ${proxyErrorDetails}. URL Original: ${playlistUrl}`;
      }
      console.error(finalDetailedErrorMessage);
      throw new Error(finalDetailedErrorMessage);
    }
    m3uString = await response.text();
  } catch (error: any) {
    if (error instanceof Error && (error.message.startsWith('O provedor da playlist em') || error.message.startsWith('Falha ao buscar playlist via proxy'))) {
        throw error;
    }
    const networkOrProxyError = `Erro ao conectar ao serviço de proxy interno da aplicação para ${playlistUrl}. Razão: ${error.message || 'Erro de fetch desconhecido'}.`;
    console.error(networkOrProxyError, error);
    throw new Error(networkOrProxyError);
  }

  const lines = m3uString.split(/\r?\n/);
  const items: MediaItem[] = [];
  let currentRawItem: Record<string, any> = {};

  for (let i = 0; i < lines.length; i++) {
    if (items.length >= MAX_ITEMS_PER_PLAYLIST) {
      console.log(`Alcançado MAX_ITEMS_PER_PLAYLIST (${MAX_ITEMS_PER_PLAYLIST}) para playlist ID: ${playlistId}. Parando análise para esta playlist.`);
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
        // If no comma, the whole string might be attributes or just the title (less common in m3u_plus)
        // For robustness, assume it could be attributes if it contains '=', otherwise title
        if (!attributesString.includes('=')) {
            extinfTitle = attributesString;
            attributesString = ""; // No attributes
        }
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
        currentRawItem.title = currentRawItem.tvgname.trim();
      } else if (currentRawItem.title && currentRawItem.title.trim() !== '') {
        // Title already set from extinfTitle, ensure it's trimmed
        currentRawItem.title = currentRawItem.title.trim();
      } else {
        currentRawItem.title = 'Item Sem Título'; // Fallback title
      }

      // Standardize tvgId (some playlists use tvg-id, others tvgid)
      if (currentRawItem.tvgid && !currentRawItem.tvgId) { 
          currentRawItem.tvgId = currentRawItem.tvgid;
      }


      if (currentRawItem.tvglogo) {
        currentRawItem.posterUrl = currentRawItem.tvglogo;
      }
      // grouptitle is captured as currentRawItem.grouptitle
      // tvg-genre is captured as currentRawItem.tvggenre

    } else if (line && !line.startsWith('#')) {
      if (currentRawItem.title ) { // Ensure we have at least a title from #EXTINF
        const streamUrl = line;
        const {
          posterUrl,
          grouptitle, // from M3U
          tvggenre, // from M3U
          tvgId, // from M3U (standardized from tvg-id or tvgid)
          originatingPlaylistId: itemOriginatingPlaylistId, 
          originatingPlaylistName: itemOriginatingPlaylistName 
        } = currentRawItem;

        const finalTitle = currentRawItem.title;

        const itemIndexInFile = items.length;
        // Unique ID incorporating playlist and item specifics
        let semanticPart = tvgId || currentRawItem.tvgchno || finalTitle.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 30) || `item${itemIndexInFile}`;
        if (semanticPart.length === 0) semanticPart = `item${itemIndexInFile}`; // Ensure semanticPart is not empty
        const itemId = `${itemOriginatingPlaylistId}-${semanticPart}-${itemIndexInFile}`;

        let mediaType: MediaType;
        const lowerStreamUrl = streamUrl.toLowerCase();
        const lowerTitle = finalTitle.toLowerCase();
        const lowerGroupTitle = (grouptitle || '').toLowerCase();
        const isVODStreamByExtension = VOD_EXTENSIONS.some(ext => lowerStreamUrl.endsWith(ext));

        // Enhanced MediaType Detection Logic:
        if (lowerStreamUrl.endsWith('.ts')) { // Rule 1: .ts extension is a channel
            mediaType = 'channel';
        } else if (lowerStreamUrl.includes('series')) { // Rule 2: 'series' in URL
            mediaType = 'series';
        } else if (lowerStreamUrl.includes('movies')) { // Rule 3: 'movies' in URL
            mediaType = 'movie';
        } else if (lowerTitle.includes('ppv')) { // Rule 4: 'ppv' in title indicates a channel
            mediaType = 'channel';
        } else if (GROUP_CHANNEL_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) {
          mediaType = 'channel';
        } else if (GROUP_MOVIE_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) {
          mediaType = 'movie';
        } else if (GROUP_SERIES_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) {
          mediaType = 'series';
        } else if (isVODStreamByExtension) {
          if (SERIES_PATTERN.test(finalTitle) || TITLE_SERIES_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
            mediaType = 'series';
          } else { 
            mediaType = 'movie';
          }
        } else if (SERIES_PATTERN.test(finalTitle) || TITLE_SERIES_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
          mediaType = 'series';
        } else if (TITLE_MOVIE_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
          mediaType = 'movie';
        } else if (GENERAL_TITLE_CHANNEL_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
          mediaType = 'channel';
        } else {
          mediaType = 'channel'; // Fallback
        }

        let finalGenre: string | undefined = undefined;
        if (mediaType === 'movie' || mediaType === 'series') {
            if (tvggenre && tvggenre.trim() !== '') {
                finalGenre = tvggenre.trim();
            } else if (grouptitle && grouptitle.trim() !== '' && !GROUP_CHANNEL_KEYWORDS.some(keyword => lowerGroupTitle.includes(keyword))) { 
                finalGenre = grouptitle.trim();
            }
        }

        const mediaItem: MediaItem = {
          id: itemId,
          type: mediaType,
          title: finalTitle,
          posterUrl: posterUrl,
          streamUrl: streamUrl,
          groupTitle: grouptitle, 
          tvgId: tvgId, 
          genre: finalGenre, 
          description: currentRawItem.description || `Título: ${finalTitle}. Grupo: ${grouptitle || 'N/A'}. Tipo: ${mediaType}. Analisado da playlist: ${playlistName || playlistId}`,
          originatingPlaylistId: itemOriginatingPlaylistId,
          originatingPlaylistName: itemOriginatingPlaylistName,
        };
        items.push(mediaItem);
        currentRawItem = {}; 
      }
    }
  }
  console.log(`Analisados ${items.length} itens da URL original: ${playlistUrl} (Playlist: ${playlistName || playlistId})`);
  return items;
}
