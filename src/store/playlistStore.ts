
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage, type PersistOptions } from 'zustand/middleware';
import type { PlaylistItem, MediaItem, EpgProgram, StartPagePath, RecentlyPlayedItem, PlaybackProgressData, PlaylistType, XCAPIResponse, XCUserInfo } from '@/types';
import { parseM3U } from '@/lib/m3u-parser';
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
  }) => Promise<void>;
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
  'playlists' | 'epgUrl' | 'preferredStartPage' | 'favoriteItemIds' | 'playbackProgress' | 'recentlyPlayed'
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
  }),
   onRehydrateStorage: () => { 
    console.log("StreamVerse: Hydration from localStorage has started.");
    return (_rehydratedState, error) => {
      if (error) {
        console.error("StreamVerse: Failed to rehydrate state from localStorage:", error);
      } else {
        console.log("StreamVerse: Successfully rehydrated state from localStorage.");
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
          updatedRecentlyPlayed.unshift({ itemId, timestamp: Date.now() }); 
          return {
            recentlyPlayed: updatedRecentlyPlayed.slice(0, MAX_RECENTLY_PLAYED_ITEMS), 
          };
        });
      },

      addPlaylist: async (playlistData) => {
        const { type, url, xcDns, xcUsername, xcPassword, name } = playlistData;
        
        if (type === 'm3u' && url && get().playlists.some(p => p.type === 'm3u' && p.url === url)) {
          const errorMsg = `Playlist URL "${url}" já existe.`;
          set({ error: errorMsg });
          console.warn(errorMsg);
          return;
        }
        if (type === 'xc' && xcDns && xcUsername && get().playlists.some(p => p.type === 'xc' && p.xcDns === xcDns && p.xcUsername === xcUsername)) {
          const errorMsg = `Playlist Xtream Codes com DNS "${xcDns}" e usuário "${xcUsername}" já existe.`;
          set({ error: errorMsg });
          console.warn(errorMsg);
          return;
        }
        
        set({ isLoading: true, error: null }); 
        
        try {
          let newPlaylist: PlaylistItem = {
            id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 7)}`,
            type,
            name: name || (type === 'm3u' ? (url || `Playlist M3U ${get().playlists.length + 1}`) : (xcDns || `Playlist XC ${get().playlists.length + 1}`)),
            addedAt: new Date().toISOString(),
          };

          if (type === 'm3u' && url) {
            newPlaylist.url = url;
          } else if (type === 'xc' && xcDns && xcUsername && xcPassword) {
            newPlaylist.xcDns = xcDns;
            newPlaylist.xcUsername = xcUsername;
            newPlaylist.xcPassword = xcPassword; 

            try {
              const userInfoUrl = `${xcDns}/player_api.php?username=${xcUsername}&password=${xcPassword}`;
              const proxyUserInfoUrl = `/api/proxy?url=${encodeURIComponent(userInfoUrl)}`;
              const response = await fetch(proxyUserInfoUrl);
              if (!response.ok) {
                const errorText = await response.text();
                console.warn(`Falha ao buscar informações do usuário XC para ${xcDns} (status ${response.status}): ${errorText}`);
              } else {
                const data: XCAPIResponse = await response.json();
                if (data && data.user_info && data.user_info.exp_date) {
                  const expiryTimestamp = parseInt(data.user_info.exp_date, 10);
                  if (!isNaN(expiryTimestamp)) {
                    newPlaylist.expiryDate = new Date(expiryTimestamp * 1000).toISOString();
                  }
                } else if (data && (data as unknown as XCUserInfo).exp_date) { 
                   const expiryTimestamp = parseInt((data as unknown as XCUserInfo).exp_date as string, 10);
                   if (!isNaN(expiryTimestamp)) {
                    newPlaylist.expiryDate = new Date(expiryTimestamp * 1000).toISOString();
                  }
                }
              }
            } catch (e: any) {
              console.warn(`Erro ao buscar data de validade para playlist XC ${xcDns}: ${e.message}`);
            }
          } else {
            throw new Error("Dados da playlist inválidos fornecidos.");
          }

          set((state) => ({
            playlists: [...state.playlists, newPlaylist],
          }));
          await get().fetchAndParsePlaylists(true); 
        } catch (e: any) { 
          console.error("Erro no processo addPlaylist:", e);
          set({ isLoading: false, error: e.message || "Falha ao adicionar playlist." });
        }
      },
      removePlaylist: (id: string) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
          mediaItems: state.mediaItems.filter(item => item.originatingPlaylistId !== id)
        }));
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

        // Check if core content-affecting details changed
        if (originalPlaylist.type === 'm3u' && originalPlaylist.url !== updatedPlaylist.url) {
          playlistNeedsContentRefresh = true;
        } else if (originalPlaylist.type === 'xc' && (
          originalPlaylist.xcDns !== updatedPlaylist.xcDns ||
          originalPlaylist.xcUsername !== updatedPlaylist.xcUsername ||
          originalPlaylist.xcPassword !== updatedPlaylist.xcPassword
        )) {
          playlistNeedsContentRefresh = true;
          // Re-fetch expiry date if XC credentials changed
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
        set({ playlists: newPlaylists, isLoading: false }); // Set isLoading false after state update

        if (playlistNeedsContentRefresh) {
          await get().fetchAndParsePlaylists(true);
        }
      },
      fetchAndParsePlaylists: async (forceRefresh = false) => {
        if (!forceRefresh && get().mediaItems.length > 0 && !get().isLoading) {
          return;
        }
        set({ isLoading: true, error: null }); 
        if (forceRefresh || get().mediaItems.length === 0) { // Ensure mediaItems are cleared if they should be
           set({ mediaItems: [] });
        }
        
        const currentPlaylists = get().playlists;
        let allMediaItems: MediaItem[] = [];
        let encounteredErrors: string[] = [];

        try {
          if (currentPlaylists.length === 0) {
            set({ mediaItems: [], isLoading: false, error: null });
            return;
          }

          const results = await Promise.allSettled(
            currentPlaylists.map(playlist => {
              let m3uUrlToFetch: string;
              if (playlist.type === 'xc' && playlist.xcDns && playlist.xcUsername && playlist.xcPassword) {
                m3uUrlToFetch = `${playlist.xcDns}/get.php?username=${playlist.xcUsername}&password=${playlist.xcPassword}&type=m3u_plus&output=m3u8`;
              } else if (playlist.type === 'm3u' && playlist.url) {
                m3uUrlToFetch = playlist.url;
              } else {
                return Promise.reject(new Error(`Configuração de playlist inválida para ${playlist.name || playlist.id}`));
              }
              return parseM3U(m3uUrlToFetch, playlist.id, playlist.name);
            })
          );

          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              allMediaItems = [...allMediaItems, ...result.value];
            } else {
              const playlistIdentifier = currentPlaylists[index]?.name || currentPlaylists[index]?.id || `Playlist no índice ${index}`;
              console.error(`StreamVerse: Falha ao analisar playlist ${playlistIdentifier}:`, result.reason);
              const reasonMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
              encounteredErrors.push(`Erro ao carregar "${playlistIdentifier}": ${reasonMessage}`);
            }
          });
          
          set({ 
            mediaItems: allMediaItems, 
            isLoading: false, 
            error: encounteredErrors.length > 0 ? encounteredErrors.join('; ') : null 
          });

        } catch (e: any) { 
          console.error("StreamVerse: Erro inesperado em fetchAndParsePlaylists:", e);
          set({ isLoading: false, error: e.message || "Ocorreu um erro inesperado ao carregar itens de mídia." });
        }
      },

      setEpgUrl: async (url: string | null) => {
        set({ epgUrl: url, epgError: null, epgData: {} }); 
        if (url) {
          await get().fetchAndParseEpg(true); 
        } else {
          set({ epgLoading: false }); 
        }
      },
      fetchAndParseEpg: async (forceRefresh = false) => {
        const epgUrl = get().epgUrl;
        if (!epgUrl) {
          set({ epgData: {}, epgLoading: false, epgError: null });
          return;
        }
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
                try {
                    const textError = await response.text();
                    proxyErrorDetails = textError || proxyErrorDetails;
                } catch (textReadError) {
                    proxyErrorDetails = 'Proxy não retornou uma resposta JSON, e seu corpo não pôde ser lido como texto.';
                }
            }
            const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;
            throw new Error(`Falha ao buscar EPG de ${epgUrl} via proxy (${upstreamStatusDescription}). Proxy: ${proxyErrorDetails}`);
          }
          const xmlString = await response.text();
          if (!xmlString.trim().startsWith('<')) { 
             const errorDetail = `Dados EPG de ${epgUrl} não parecem ser XML válido (não começa com '<'). Verifique a URL do EPG. Conteúdo recebido (primeiros 100 caracteres): ${xmlString.substring(0,100)}...`;
             console.warn(errorDetail);
             throw new Error(errorDetail); 
          }
          const parsedEpgData = parseXMLTV(xmlString); 
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
        });
        // No need to manually clear localStorage for 'mediaItems' as it's not partialized anymore
      },
    }),
    persistOptions
  )
);

if (typeof window !== 'undefined') {
  // console.log("StreamVerse: Estado inicial da store antes da reidratação:", usePlaylistStore.getState());
}

    