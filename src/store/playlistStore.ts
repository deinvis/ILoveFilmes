
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
  mediaItems: MediaItem[]; // Current session's media items (not directly persisted this way)
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
  // Provide a mock for SSR or environments where localStorage is not available
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
};

// Define which parts of the state to persist
type PersistentPlaylistState = Pick<
  PlaylistState,
  'playlists' | 'epgUrl' | 'preferredStartPage' | 'favoriteItemIds' | 'playbackProgress' | 'recentlyPlayed' | 'parentalControlEnabled'
>;

const persistOptions: PersistOptions<PlaylistState, PersistentPlaylistState> = {
  name: 'streamverse-storage',
  storage: createJSONStorage(() => getLocalStorage()),
  partialize: (state) => ({
    playlists: state.playlists, // Playlists (including fileContent for file-based ones) are persisted
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
        // Defer actions until the store is fully initialized and accessible
        setTimeout(() => {
            const currentState = usePlaylistStore.getState();
            if ((currentState.playlists.length > 0) && !currentState.isLoading) {
                 console.log("StreamVerse: Rehydrated playlist definitions found, (re)building session media items.");
                 currentState.fetchAndParsePlaylists();
            }
            if (currentState.epgUrl && Object.keys(currentState.epgData).length === 0 && !currentState.epgLoading) {
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
      mediaItems: [], // Current session's media items (derived, not directly persisted)
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
            delete newProgress[itemId]; // Remove progress if video is considered watched
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

      parentalControlEnabled: true,
      setParentalControlEnabled: (enabled: boolean) => {
        set({ parentalControlEnabled: enabled });
        get().fetchAndParsePlaylists(true); // Re-process media items with new filter state
      },

      addPlaylistFromFileContent: async (fileContent: string, fileName: string) => {
        set({ isLoading: true, error: null });
        try {
            const tempPlaylistId = `${Date.now().toString()}-${Math.random().toString(36).substring(2, 7)}`;
            const playlistNameForItems = fileName.trim() || `Arquivo ${tempPlaylistId.substring(0, 6)}`;
            
            const newPlaylist: PlaylistItem = {
                id: tempPlaylistId,
                type: 'm3u',
                name: playlistNameForItems,
                source: 'file',
                fileContent: fileContent, // Store the raw file content
                addedAt: new Date().toISOString(),
            };

            set((state) => ({
                playlists: [...state.playlists, newPlaylist],
            }));
            await get().fetchAndParsePlaylists(true); // This will parse the new fileContent
        } catch (e: any) {
            console.error("Erro ao adicionar playlist de arquivo:", e);
            set({ isLoading: false, error: e.message || "Falha ao adicionar playlist de arquivo." });
        }
      },

      addPlaylist: async (playlistData) => {
        const { type, url, xcDns, xcUsername, xcPassword, name, source } = playlistData;

        if (type === 'm3u' && url && source === 'url' && get().playlists.some(p => p.type === 'm3u' && p.url === url && p.source === 'url')) {
          const errorMsg = `Playlist URL "${url}" já existe.`;
          set({ error: errorMsg, isLoading: false });
          console.warn(errorMsg);
          return;
        }
        if (type === 'xc' && xcDns && xcUsername && get().playlists.some(p => p.type === 'xc' && p.xcDns === xcDns && p.xcUsername === xcUsername)) {
          const errorMsg = `Playlist Xtream Codes com DNS "${xcDns}" e usuário "${xcUsername}" já existe.`;
          set({ error: errorMsg, isLoading: false });
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
            source: source || (type === 'm3u' ? 'url' : undefined)
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
              } else {
                const data: XCAPIResponse = await response.json();
                if (data && data.user_info && data.user_info.exp_date) {
                  const expiryTimestamp = parseInt(data.user_info.exp_date, 10);
                  if (!isNaN(expiryTimestamp)) {
                    newPlaylist.expiryDate = new Date(expiryTimestamp * 1000).toISOString();
                  }
                } else if (data && (data as unknown as XCUserInfo).exp_date) { // Handle direct exp_date
                   const expiryTimestamp = parseInt((data as unknown as XCUserInfo).exp_date as string, 10);
                   if (!isNaN(expiryTimestamp)) {
                    newPlaylist.expiryDate = new Date(expiryTimestamp * 1000).toISOString();
                  }
                }
              }
            } catch (e: any) {
              console.warn(`Erro ao buscar data de validade para playlist XC ${xcDns}: ${e.message}`);
            }
          } else if (type === 'm3u' && source === 'file'){
             console.warn("addPlaylist foi chamada com type 'm3u' e source 'file'. Use addPlaylistFromFileContent.");
             set({isLoading: false, error: "Erro interno: Tentativa de adicionar playlist de arquivo pelo caminho errado."});
             return;
          } else if (type === 'm3u' && !url && source === 'url'){
             throw new Error("URL da playlist M3U não fornecida.");
          }


          set((state) => ({
            playlists: [...state.playlists, newPlaylist],
          }));
          await get().fetchAndParsePlaylists(true); // Refresh media items
        } catch (e: any) {
          console.error("Erro no processo addPlaylist:", e);
          set({ isLoading: false, error: e.message || "Falha ao adicionar playlist." });
        }
      },

      removePlaylist: (id: string) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
        }));
        get().fetchAndParsePlaylists(true); // Refresh media items after removal
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

        if (originalPlaylist.source === 'file') {
            // Name change only, no content refresh needed from here
        } else if (originalPlaylist.type === 'm3u' && originalPlaylist.url !== updatedPlaylist.url) {
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
                } else if (data && (data as unknown as XCUserInfo).exp_date) { // Handle direct exp_date
                   const expiryTimestamp = parseInt((data as unknown as XCUserInfo).exp_date as string, 10);
                   updatedPlaylist.expiryDate = !isNaN(expiryTimestamp) ? new Date(expiryTimestamp * 1000).toISOString() : undefined;
                } else {
                    updatedPlaylist.expiryDate = undefined; // Clear if not found
                }
              } else {
                console.warn(`Falha ao buscar informações do usuário XC para ${updatedPlaylist.xcDns} durante atualização.`);
                updatedPlaylist.expiryDate = undefined;
              }
            } catch (e: any) {
              console.warn(`Erro ao buscar data de validade para playlist XC ${updatedPlaylist.xcDns} durante atualização: ${e.message}`);
              updatedPlaylist.expiryDate = undefined;
            }
          }
        }
        
        const newPlaylists = [...originalPlaylists];
        newPlaylists[playlistIndex] = updatedPlaylist;
        set({ playlists: newPlaylists });

        if (playlistNeedsContentRefresh) {
          await get().fetchAndParsePlaylists(true);
        } else {
          set ({ isLoading: false }); // Ensure isLoading is false if no full refresh
        }
      },

      fetchAndParsePlaylists: async (forceRefresh = false) => {
        const currentPlaylists = get().playlists;
        if (!forceRefresh && get().mediaItems.length > 0 && !get().isLoading) {
          // If not forcing refresh, and mediaItems exist, and not already loading, do nothing.
          // This prevents re-fetching if data is already in session memory.
          // The onRehydrateStorage handles initial load from persisted playlist definitions.
          //return; // This might be too aggressive if a playlist definition was changed without forceRefresh.
                  // For now, we will re-process definitions unless isLoading is true.
        }

        set({ isLoading: true, error: null });
        
        if (currentPlaylists.length === 0) {
          set({ mediaItems: [], isLoading: false, error: null });
          return;
        }
        
        let allParsedMediaItems: MediaItem[] = [];
        let encounteredErrors: string[] = [];

        const playlistProcessingPromises = currentPlaylists.map(async (playlist) => {
          try {
            if (playlist.source === 'file' && playlist.fileContent) {
              return parseM3UContent(playlist.fileContent, playlist.id, playlist.name);
            } else if (playlist.type === 'xc' && playlist.xcDns && playlist.xcUsername && playlist.xcPassword) {
              const m3uUrlToFetch = `${playlist.xcDns}/get.php?username=${playlist.xcUsername}&password=${playlist.xcPassword}&type=m3u_plus&output=m3u8`;
              return fetchAndParseM3UUrl(m3uUrlToFetch, playlist.id, playlist.name);
            } else if (playlist.type === 'm3u' && playlist.url && playlist.source === 'url') {
              return fetchAndParseM3UUrl(playlist.url, playlist.id, playlist.name);
            }
            return []; // Return empty array for playlists that don't match criteria or invalid
          } catch (error: any) {
            const playlistIdentifier = playlist.name || playlist.id || `Playlist Desconhecida`;
            console.warn(`StreamVerse: Falha ao processar playlist ${playlistIdentifier}:`, error);
            const reasonMessage = error instanceof Error ? error.message : String(error);
            encounteredErrors.push(`Erro ao carregar "${playlistIdentifier}": ${reasonMessage}`);
            return []; // Return empty array on error for this specific playlist
          }
        });

        const results = await Promise.allSettled(playlistProcessingPromises);

        results.forEach((result) => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                allParsedMediaItems.push(...result.value);
            }
            // Errors are already collected inside the promises
        });
          
        // Ensure unique items based on ID, though IDs should be unique per source already
        const uniqueMediaItems = Array.from(new Map(allParsedMediaItems.map(item => [item.id, item])).values());

        set({ 
          mediaItems: uniqueMediaItems, 
          isLoading: false, 
          error: encounteredErrors.length > 0 ? encounteredErrors.join('; ') : null 
        });
      },

      setEpgUrl: async (url: string | null) => {
        set({ epgUrl: url, epgError: null, epgData: {} }); // Clear previous EPG data
        if (url) {
          await get().fetchAndParseEpg(true);
        } else {
          set({ epgLoading: false }); // Ensure loading is false if URL is cleared
        }
      },
      fetchAndParseEpg: async (forceRefresh = false) => {
        const epgUrl = get().epgUrl;
        if (!epgUrl) {
          set({ epgData: {}, epgLoading: false, epgError: null });
          return;
        }

        if (!forceRefresh && Object.keys(get().epgData).length > 0 && !get().epgLoading) {
          // Data already loaded and not forcing refresh
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
            } catch (e) { // If proxy error is not JSON
                try {
                    const textError = await response.text(); // Try to get text error
                    proxyErrorDetails = textError || proxyErrorDetails;
                } catch (textReadError) {
                    // proxyErrorDetails remains as default
                }
            }
            const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;
            throw new Error(`Falha ao buscar EPG de ${epgUrl} via proxy (${upstreamStatusDescription}). Proxy: ${proxyErrorDetails}`);
          }
          
          const xmlString = await response.text();
          
          // Basic check if the content seems like XML before passing to parser
          if (!xmlString.trim().startsWith('<')) { 
             console.warn(`Dados EPG de ${epgUrl} não parecem ser XML válido. Conteúdo (primeiros 100 caracteres): ${xmlString.substring(0,100)}...`);
             // Still attempt to parse, let the parser throw the detailed error if it fails
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
          parentalControlEnabled: true,
        });
      },
    }),
    persistOptions
  )
);
