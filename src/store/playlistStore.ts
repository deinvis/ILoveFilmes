
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage, type PersistOptions } from 'zustand/middleware';
import type { PlaylistItem, MediaItem, EpgProgram, StartPagePath, RecentlyPlayedItem, PlaybackProgressData, PlaylistType, XCAPIResponse, XCUserInfo } from '@/types';
import { parseM3UContent, fetchAndParseM3UUrl } from '@/lib/m3u-parser';
import { parseXMLTV } from '@/lib/xmltv-parser';

const MAX_RECENTLY_PLAYED_ITEMS = 20;
const DEFAULT_START_PAGE: StartPagePath = '/app/channels';

interface PlaylistState {
  playlists: PlaylistItem[];
  mediaItems: MediaItem[]; 
  addPlaylist: (playlistData: {
    type: PlaylistType;
    url?: string; 
    xcDns?: string; 
    xcUsername?: string; 
    xcPassword?: string; 
    name?: string;
    source?: 'url' | 'file';
  }) => Promise<void>;
  addPlaylistFromFileContent: (fileContent: string, fileName: string) => Promise<void>;
  removePlaylist: (id: string) => void;
  updatePlaylist: (playlistId: string, updates: Partial<PlaylistItem>) => Promise<void>;
  fetchAndParsePlaylists: (forceRefresh?: boolean) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  
  epgUrl: string | null;
  epgData: Record<string, EpgProgram[]>; 
  epgLoading: boolean;
  epgError: string | null;
  setEpgUrl: (url: string | null) => Promise<void>;
  fetchAndParseEpg: (forceRefresh?: boolean) => Promise<void>;

  preferredStartPage: StartPagePath;
  setPreferredStartPage: (path: StartPagePath) => void;

  favoriteItemIds: string[];
  toggleFavorite: (itemId: string) => void;
  isFavorite: (itemId: string) => boolean;

  playbackProgress: Record<string, PlaybackProgressData>;
  updatePlaybackProgress: (itemId: string, currentTime: number, duration: number) => void;
  getPlaybackProgress: (itemId: string) => PlaybackProgressData | undefined;

  recentlyPlayed: RecentlyPlayedItem[];
  addRecentlyPlayed: (itemId: string) => void;

  parentalControlEnabled: boolean;
  setParentalControlEnabled: (enabled: boolean) => void;

  resetAppState: () => void;
}

const getLocalStorage = () => {
  if (typeof window !== 'undefined') {
    return localStorage;
  }
  // Fallback for SSR or environments where localStorage is not available
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
};

type PersistentPlaylistState = Pick<
  PlaylistState, 
  'playlists' | 'epgUrl' | 'preferredStartPage' | 'favoriteItemIds' | 'playbackProgress' | 'recentlyPlayed' | 'parentalControlEnabled'
>;

const persistOptions: PersistOptions<PlaylistState, PersistentPlaylistState> = {
  name: 'streamverse-storage', 
  storage: createJSONStorage(() => getLocalStorage()),
  partialize: (state) => ({
    playlists: state.playlists,
    epgUrl: state.epgUrl,
    preferredStartPage: state.preferredStartPage,
    favoriteItemIds: state.favoriteItemIds,
    playbackProgress: state.playbackProgress,
    recentlyPlayed: state.recentlyPlayed,
    parentalControlEnabled: state.parentalControlEnabled,
  }),
   onRehydrateStorage: () => { 
    console.log("StreamVerse: Hydration from localStorage has started.");
    return (_rehydratedState, error) => {
      if (error) {
        console.error("StreamVerse: Failed to rehydrate state from localStorage:", error);
      } else {
        console.log("StreamVerse: Successfully rehydrated state from localStorage.");
        // Use setTimeout to ensure this runs after the store is fully initialized
        setTimeout(() => {
            const currentState = usePlaylistStore.getState();
            const { playlists, mediaItems, epgUrl, epgData } = currentState;
            
            if (playlists.length > 0 && mediaItems.length === 0 && !currentState.isLoading) {
                 console.log("StreamVerse: Rehydrated playlists found, fetching initial media items.");
                 currentState.fetchAndParsePlaylists();
            }
            if (epgUrl && Object.keys(epgData).length === 0 && !currentState.epgLoading) {
                console.log("StreamVerse: Rehydrated EPG URL found, fetching initial EPG data.");
                currentState.fetchAndParseEpg();
            }
        }, 0);
      }
    };
  },
};

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set, get) => ({
      playlists: [],
      mediaItems: [], 
      isLoading: false,
      error: null,

      epgUrl: null, 
      epgData: {}, 
      epgLoading: false,
      epgError: null,

      preferredStartPage: DEFAULT_START_PAGE,  
      setPreferredStartPage: (path: StartPagePath) => {
        set({ preferredStartPage: path });
      },

      favoriteItemIds: [], 
      toggleFavorite: (itemId: string) => {
        set((state) => {
          const isCurrentlyFavorite = state.favoriteItemIds.includes(itemId);
          if (isCurrentlyFavorite) {
            return { favoriteItemIds: state.favoriteItemIds.filter(id => id !== itemId) };
          } else {
            return { favoriteItemIds: [...state.favoriteItemIds, itemId] };
          }
        });
      },
      isFavorite: (itemId: string) => {
        return get().favoriteItemIds.includes(itemId);
      },

      playbackProgress: {}, 
      updatePlaybackProgress: (itemId: string, currentTime: number, duration: number) => {
        if (duration > 0 && currentTime > 5 && currentTime / duration < 0.95) { 
          set(state => ({
            playbackProgress: {
              ...state.playbackProgress,
              [itemId]: { currentTime, duration }
            }
          }));
        } else if (duration > 0 && currentTime / duration >= 0.95) { 
          // If video is almost finished, remove progress to start from beginning next time
          set(state => {
            const newProgress = { ...state.playbackProgress };
            delete newProgress[itemId]; 
            return { playbackProgress: newProgress };
          });
        }
      },
      getPlaybackProgress: (itemId: string) => {
        return get().playbackProgress[itemId];
      },

      recentlyPlayed: [],
      addRecentlyPlayed: (itemId: string) => {
        set((state) => {
          const updatedRecentlyPlayed = state.recentlyPlayed.filter(item => item.itemId !== itemId);
          updatedRecentlyPlayed.unshift({ itemId, timestamp: Date.now() }); // Add to the beginning
          return {
            recentlyPlayed: updatedRecentlyPlayed.slice(0, MAX_RECENTLY_PLAYED_ITEMS), // Keep only the N most recent
          };
        });
      },

      parentalControlEnabled: true, // Default to true (filter active)
      setParentalControlEnabled: (enabled: boolean) => {
        set({ parentalControlEnabled: enabled });
        // Trigger a re-filter of media items.
        // No need to call fetchAndParsePlaylists if items are already in memory,
        // the filtering happens in the components' useMemo hooks.
        // However, if items are very large, re-deriving might be needed if we change how they are stored.
        // For now, this should be fine as filtering is on display lists.
      },

      addPlaylistFromFileContent: async (fileContent: string, fileName: string) => {
        set({ isLoading: true, error: null }); // Set loading true
        try {
            const tempPlaylistId = `${Date.now().toString()}-${Math.random().toString(36).substring(2, 7)}`;
            const newPlaylist: PlaylistItem = {
                id: tempPlaylistId,
                type: 'm3u',
                name: fileName,
                source: 'file', // Mark as file source
                addedAt: new Date().toISOString(),
            };

            const parsedItems = parseM3UContent(fileContent, tempPlaylistId, fileName);
            
            set((state) => ({
                playlists: [...state.playlists, newPlaylist],
                // Add parsed items directly to mediaItems, ensuring no duplicates from the same tempPlaylistId
                mediaItems: [...state.mediaItems.filter(item => item.originatingPlaylistId !== tempPlaylistId), ...parsedItems],
                // DO NOT set isLoading: false here. Let fetchAndParsePlaylists handle it.
            }));
            // Call fetchAndParsePlaylists to refresh URL-based lists and finalize loading state
            await get().fetchAndParsePlaylists(true); 
        } catch (e: any) {
            console.error("Erro ao processar playlist de arquivo:", e);
            set({ isLoading: false, error: e.message || "Falha ao processar playlist de arquivo." });
        }
      },

      addPlaylist: async (playlistData) => {
        const { type, url, xcDns, xcUsername, xcPassword, name, source } = playlistData;
        
        if (type === 'm3u' && url && source === 'url' && get().playlists.some(p => p.type === 'm3u' && p.url === url && p.source === 'url')) {
          const errorMsg = `Playlist URL "${url}" já existe.`;
          set({ error: errorMsg, isLoading: false }); // Set loading false if already exists
          console.warn(errorMsg);
          return;
        }
        if (type === 'xc' && xcDns && xcUsername && get().playlists.some(p => p.type === 'xc' && p.xcDns === xcDns && p.xcUsername === xcUsername)) {
          const errorMsg = `Playlist Xtream Codes com DNS "${xcDns}" e usuário "${xcUsername}" já existe.`;
          set({ error: errorMsg, isLoading: false }); // Set loading false if already exists
          console.warn(errorMsg);
          return;
        }
        
        set({ isLoading: true, error: null }); // Set loading true for the add operation
        
        try {
          let newPlaylist: PlaylistItem = {
            id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 7)}`,
            type,
            name: name || (type === 'm3u' ? (url || `Playlist M3U ${get().playlists.length + 1}`) : (xcDns || `Playlist XC ${get().playlists.length + 1}`)),
            addedAt: new Date().toISOString(),
            source: source || (type === 'm3u' ? 'url' : undefined) // Default M3U to 'url' if source not specified
          };

          if (type === 'm3u' && url && source === 'url') {
            newPlaylist.url = url;
          } else if (type === 'xc' && xcDns && xcUsername && xcPassword) {
            newPlaylist.xcDns = xcDns;
            newPlaylist.xcUsername = xcUsername;
            newPlaylist.xcPassword = xcPassword; 

            // Attempt to fetch expiry date for XC playlist
            try {
              const userInfoUrl = `${xcDns}/player_api.php?username=${xcUsername}&password=${xcPassword}`;
              const proxyUserInfoUrl = `/api/proxy?url=${encodeURIComponent(userInfoUrl)}`;
              const response = await fetch(proxyUserInfoUrl);
              if (!response.ok) {
                const errorText = await response.text();
                console.warn(`Falha ao buscar informações do usuário XC para ${xcDns} (status ${response.status}): ${errorText}`);
                // Do not throw error, just proceed without expiry date
              } else {
                const data: XCAPIResponse = await response.json();
                if (data && data.user_info && data.user_info.exp_date) {
                  const expiryTimestamp = parseInt(data.user_info.exp_date, 10);
                  if (!isNaN(expiryTimestamp)) {
                    newPlaylist.expiryDate = new Date(expiryTimestamp * 1000).toISOString();
                  }
                } else if (data && (data as unknown as XCUserInfo).exp_date) { // Handle direct exp_date if user_info is not present
                   const expiryTimestamp = parseInt((data as unknown as XCUserInfo).exp_date as string, 10);
                   if (!isNaN(expiryTimestamp)) {
                    newPlaylist.expiryDate = new Date(expiryTimestamp * 1000).toISOString();
                  }
                }
              }
            } catch (e: any) {
              console.warn(`Erro ao buscar data de validade para playlist XC ${xcDns}: ${e.message}`);
            }
          } else if (type === 'm3u' && source === 'file') {
            // This case should be handled by addPlaylistFromFileContent
            console.warn("addPlaylist foi chamada com type 'm3u' e source 'file'. Use addPlaylistFromFileContent.");
            set({isLoading: false, error: "Erro interno: Tentativa de adicionar playlist de arquivo pelo caminho errado."});
            return;
          } else if (type === 'm3u' && !url && source === 'url'){
             // This implies an attempt to add a URL-based M3U without a URL.
             throw new Error("URL da playlist M3U não fornecida.");
          }


          set((state) => ({
            playlists: [...state.playlists, newPlaylist],
            // isLoading: false, // DO NOT set isLoading: false here. Let fetchAndParsePlaylists handle it.
          }));
          // After adding the playlist (URL or XC), fetch all items
          await get().fetchAndParsePlaylists(true); // forceRefresh to re-evaluate all
        } catch (e: any) { 
          console.error("Erro no processo addPlaylist:", e);
          set({ isLoading: false, error: e.message || "Falha ao adicionar playlist." });
        }
      },
      removePlaylist: (id: string) => {
        const playlistToRemove = get().playlists.find(p => p.id === id);
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
          // Remove media items originating from this playlist
          mediaItems: state.mediaItems.filter(item => item.originatingPlaylistId !== id)
          // isLoading: false // No async operation here, so no explicit loading state change needed unless a refresh is triggered
        }));
        // Optionally, trigger a UI refresh or re-filtering if needed,
        // but mediaItems array is directly modified.
      },
      updatePlaylist: async (playlistId: string, updates: Partial<PlaylistItem>) => {
        set({ isLoading: true, error: null });
        let playlistNeedsContentRefresh = false;
        const originalPlaylists = get().playlists;
        const playlistIndex = originalPlaylists.findIndex(p => p.id === playlistId);

        if (playlistIndex === -1) {
          set({ isLoading: false, error: `Playlist com ID ${playlistId} não encontrada.` });
          return;
        }

        const originalPlaylist = originalPlaylists[playlistIndex];
        const updatedPlaylist = { ...originalPlaylist, ...updates };

        // Determine if content needs refresh based on changed critical fields
        if (originalPlaylist.source === 'file') {
            // For file-based playlists, only name can be updated without re-upload.
            // If other "source" details were editable for a file (they aren't), it would need re-parsing.
        } else if (originalPlaylist.type === 'm3u' && originalPlaylist.url !== updatedPlaylist.url) {
          playlistNeedsContentRefresh = true;
        } else if (originalPlaylist.type === 'xc' && (
          originalPlaylist.xcDns !== updatedPlaylist.xcDns ||
          originalPlaylist.xcUsername !== updatedPlaylist.xcUsername ||
          originalPlaylist.xcPassword !== updatedPlaylist.xcPassword
        )) {
          playlistNeedsContentRefresh = true;
          // If XC details changed, try to fetch new expiry date
          if (updatedPlaylist.xcDns && updatedPlaylist.xcUsername && updatedPlaylist.xcPassword) {
            try {
              const userInfoUrl = `${updatedPlaylist.xcDns}/player_api.php?username=${updatedPlaylist.xcUsername}&password=${updatedPlaylist.xcPassword}`;
              const proxyUserInfoUrl = `/api/proxy?url=${encodeURIComponent(userInfoUrl)}`;
              const response = await fetch(proxyUserInfoUrl);
              if (response.ok) {
                const data: XCAPIResponse = await response.json();
                if (data && data.user_info && data.user_info.exp_date) {
                  const expiryTimestamp = parseInt(data.user_info.exp_date, 10);
                  updatedPlaylist.expiryDate = !isNaN(expiryTimestamp) ? new Date(expiryTimestamp * 1000).toISOString() : undefined;
                } else if (data && (data as unknown as XCUserInfo).exp_date) {
                   const expiryTimestamp = parseInt((data as unknown as XCUserInfo).exp_date as string, 10);
                   updatedPlaylist.expiryDate = !isNaN(expiryTimestamp) ? new Date(expiryTimestamp * 1000).toISOString() : undefined;
                } else {
                    updatedPlaylist.expiryDate = undefined; // Clear if not found
                }
              } else {
                console.warn(`Falha ao buscar informações do usuário XC para ${updatedPlaylist.xcDns} durante atualização.`);
                updatedPlaylist.expiryDate = undefined; // Clear if fetch fails
              }
            } catch (e: any) {
              console.warn(`Erro ao buscar data de validade para playlist XC ${updatedPlaylist.xcDns} durante atualização: ${e.message}`);
              updatedPlaylist.expiryDate = undefined;
            }
          }
        }
        
        const newPlaylists = [...originalPlaylists];
        newPlaylists[playlistIndex] = updatedPlaylist;
        set({ playlists: newPlaylists }); // isLoading remains true or is set by fetchAndParsePlaylists

        if (playlistNeedsContentRefresh) {
          await get().fetchAndParsePlaylists(true); // This will set isLoading: false at its end
        } else {
          set ({ isLoading: false }); // If no content refresh, set loading false here
        }
      },
      fetchAndParsePlaylists: async (forceRefresh = false) => {
        // If not forcing refresh, and we have items, and we are not already loading, assume cache is fine.
        if (!forceRefresh && get().mediaItems.length > 0 && !get().isLoading) {
           set({ isLoading: false }); // Ensure loading is false if we bail early
           return;
        }
        set({ isLoading: true, error: null }); // Set loading true for the operation
        
        const currentPlaylists = get().playlists;
        let allNewMediaItems: MediaItem[] = [];
        let encounteredErrors: string[] = [];

        if (currentPlaylists.length === 0) {
          set({ mediaItems: [], isLoading: false, error: null });
          return;
        }
        
        // Process file-based playlists first (they are already parsed and in mediaItems if added correctly)
        // When forceRefresh is true, we want to ensure we are rebuilding from the `playlists` array.
        // The `persistentFileItems` logic was to preserve items if `mediaItems` was cleared globally,
        // which is not the current strategy. Instead, we rebuild `mediaItems`.

        // Collect items from playlists that are already marked as 'file' source
        // These items should have been added by addPlaylistFromFileContent
        const itemsFromExistingFiles = get().mediaItems.filter(item => {
            const pl = currentPlaylists.find(p => p.id === item.originatingPlaylistId);
            return pl?.source === 'file';
        });
        allNewMediaItems.push(...itemsFromExistingFiles);
        
        // Process URL-based playlists (M3U and XC)
        const itemsFromUrlPlaylists = await Promise.allSettled(
            currentPlaylists
                .filter(p => p.source === 'url' || p.type === 'xc') // Only fetch URL-based or XC
                .map(playlist => {
                    let m3uUrlToFetch: string;
                    if (playlist.type === 'xc' && playlist.xcDns && playlist.xcUsername && playlist.xcPassword) {
                        // Ensure output=m3u8 for HLS compatibility
                        m3uUrlToFetch = `${playlist.xcDns}/get.php?username=${playlist.xcUsername}&password=${playlist.xcPassword}&type=m3u_plus&output=m3u8`;
                    } else if (playlist.type === 'm3u' && playlist.url && playlist.source === 'url') {
                        m3uUrlToFetch = playlist.url;
                    } else {
                        // This should ideally not happen if playlists are added correctly
                        return Promise.reject(new Error(`Configuração de playlist URL inválida para ${playlist.name || playlist.id}`));
                    }
                    return fetchAndParseM3UUrl(m3uUrlToFetch, playlist.id, playlist.name);
                })
        );

        itemsFromUrlPlaylists.forEach((result, index) => {
            // Find the original playlist by filtering those that were mapped
            const originalPlaylist = currentPlaylists.filter(p => p.source === 'url' || p.type === 'xc')[index]; 
            if (result.status === 'fulfilled') {
                allNewMediaItems = [...allNewMediaItems, ...result.value];
            } else {
                const playlistIdentifier = originalPlaylist?.name || originalPlaylist?.id || `Playlist URL no índice ${index}`;
                console.warn(`StreamVerse: Falha ao analisar playlist ${playlistIdentifier}:`, result.reason);
                const reasonMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
                encounteredErrors.push(`Erro ao carregar "${playlistIdentifier}": ${reasonMessage}`);
            }
        });
          
        // Deduplicate allNewMediaItems by id to be safe, though item IDs should be unique due to playlistId prefix
        const uniqueMediaItems = Array.from(new Map(allNewMediaItems.map(item => [item.id, item])).values());

        set({ 
          mediaItems: uniqueMediaItems, 
          isLoading: false, 
          error: encounteredErrors.length > 0 ? encounteredErrors.join('; ') : null 
        });

      },

      setEpgUrl: async (url: string | null) => {
        set({ epgUrl: url, epgError: null, epgData: {} }); // Reset EPG data when URL changes
        if (url) {
          await get().fetchAndParseEpg(true); // Force refresh EPG data
        } else {
          set({ epgLoading: false }); // If URL is cleared, stop loading
        }
      },
      fetchAndParseEpg: async (forceRefresh = false) => {
        const epgUrl = get().epgUrl;
        if (!epgUrl) {
          set({ epgData: {}, epgLoading: false, epgError: null });
          return;
        }

        // If not forcing refresh, and we have data, and not currently loading, bail.
        if (!forceRefresh && Object.keys(get().epgData).length > 0 && !get().epgLoading) {
          return;
        }

        set({ epgLoading: true, epgError: null });
        try {
          const proxyApiUrl = `/api/proxy?url=${encodeURIComponent(epgUrl)}`;
          const response = await fetch(proxyApiUrl);
          
          if (!response.ok) {
            let proxyErrorDetails = 'Não foi possível recuperar detalhes específicos do erro do proxy.';
             try {
                const errorData = await response.json();
                proxyErrorDetails = errorData.error || proxyErrorDetails;
            } catch (e) {
                // If response is not JSON, try to get text
                try {
                    const textError = await response.text();
                    proxyErrorDetails = textError || proxyErrorDetails;
                } catch (textReadError) {
                    // proxyErrorDetails remains as default
                }
            }
            const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;
            throw new Error(`Falha ao buscar EPG de ${epgUrl} via proxy (${upstreamStatusDescription}). Proxy: ${proxyErrorDetails}`);
          }
          
          const xmlString = await response.text();
          
          // Basic check if it looks like XML before parsing
          if (!xmlString.trim().startsWith('<')) { 
             const errorDetail = `Dados EPG de ${epgUrl} não parecem ser XML válido (não começa com '<'). Verifique a URL do EPG. Conteúdo recebido (primeiros 100 caracteres): ${xmlString.substring(0,100)}...`;
             // This might be too strict if a valid XML is served with leading whitespace,
             // but DOMParser should handle that. The parsererror check is more robust.
             // console.warn(errorDetail); // Log for debugging, but let parser decide
          }

          const parsedEpgData = parseXMLTV(xmlString); // parseXMLTV should throw if XML is malformed
          set({ epgData: parsedEpgData, epgLoading: false, epgError: null });
        } catch (e: any) {
          console.error("StreamVerse: Erro ao buscar ou analisar dados EPG:", e);
          set({ epgLoading: false, epgError: e.message || "Ocorreu um erro ao processar dados EPG." });
        }
      },
      resetAppState: () => {
        console.log("StreamVerse: Redefinindo estado da aplicação.");
        set({
          playlists: [],
          mediaItems: [],
          isLoading: false,
          error: null,
          epgUrl: null,
          epgData: {},
          epgLoading: false,
          epgError: null,
          preferredStartPage: DEFAULT_START_PAGE,
          favoriteItemIds: [],
          playbackProgress: {},
          recentlyPlayed: [],
          parentalControlEnabled: true, // Reset to default
        });
      },
    }),
    persistOptions
  )
);

