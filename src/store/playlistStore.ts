
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage, type PersistOptions } from 'zustand/middleware';
import type { PlaylistItem, MediaItem, EpgProgram, StartPagePath, RecentlyPlayedItem, PlaybackProgressData, PlaylistType, XCAPIResponse, XCUserInfo } from '@/types';
import { parseM3UContent, fetchAndParseM3UUrl } from '@/lib/m3u-parser';
import { parseXMLTV } from '@/lib/xmltv-parser';

const MAX_RECENTLY_PLAYED_ITEMS = 10; // Reduced from 20
const MAX_PLAYBACK_PROGRESS_ENTRIES = 200; // New limit for playback progress entries
const DEFAULT_START_PAGE: StartPagePath = '/app/channels';

interface PlaylistState {
  playlists: PlaylistItem[];
  mediaItems: MediaItem[]; // Not persisted, session only
  addPlaylist: (playlistData: {
    type: PlaylistType;
    url?: string;
    xcDns?: string;
    xcUsername?: string;
    xcPassword?: string;
    name?: string;
  }) => Promise<void>;
  addPlaylistFromFileContent: (fileContent: string, fileName: string) => Promise<void>;
  removePlaylist: (id: string) => void;
  updatePlaylist: (playlistId: string, updates: Partial<PlaylistItem>) => Promise<void>;
  fetchAndParsePlaylists: (forceRefresh?: boolean) => Promise<void>;
  isLoading: boolean;
  error: string | null;

  epgUrl: string | null;
  epgData: Record<string, EpgProgram[]>; // Not persisted, session only
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
  // Provide a mock for SSR or environments where localStorage isn't available
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
    playlists: state.playlists.map(p => {
      // Ensure fileContent is NOT persisted with the playlist definition
      const { ...rest } = p; // fileContent was removed from PlaylistItem for persistence
      return rest;
    }),
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
        // Trigger fetches after rehydration if necessary
        setTimeout(() => {
            const currentState = usePlaylistStore.getState();
            if (currentState.playlists.length > 0 && !currentState.isLoading) {
                 console.log("StreamVerse: Rehydrated playlist definitions found, fetching media items.");
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
      mediaItems: [], // Session only
      isLoading: false,
      error: null,

      epgUrl: null,
      epgData: {}, // Session only
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
          set(state => {
            const newProgress = { ...state.playbackProgress };
            newProgress[itemId] = { currentTime, duration, lastUpdatedAt: Date.now() };

            // Enforce MAX_PLAYBACK_PROGRESS_ENTRIES
            const progressKeys = Object.keys(newProgress);
            if (progressKeys.length > MAX_PLAYBACK_PROGRESS_ENTRIES) {
              // Sort by lastUpdatedAt and remove the oldest ones
              const sortedKeys = progressKeys.sort((a, b) => newProgress[a].lastUpdatedAt - newProgress[b].lastUpdatedAt);
              const keysToRemoveCount = sortedKeys.length - MAX_PLAYBACK_PROGRESS_ENTRIES;
              for (let i = 0; i < keysToRemoveCount; i++) {
                delete newProgress[sortedKeys[i]];
              }
            }
            return { playbackProgress: newProgress };
          });
        } else if (duration > 0 && currentTime / duration >= 0.95) {
          // Remove progress if video is considered watched
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

      parentalControlEnabled: true,
      setParentalControlEnabled: (enabled: boolean) => {
        set({ parentalControlEnabled: enabled });
        // No need to call fetchAndParsePlaylists here, pages will re-filter based on the new state.
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
                source: 'file', // Mark as file source
                // fileContent is NOT included here for persistence
                addedAt: new Date().toISOString(),
            };

            const parsedFileItems = parseM3UContent(fileContent, tempPlaylistId, playlistNameForItems);
            
            set((state) => ({
                playlists: [...state.playlists, newPlaylist], // Add playlist definition
                // Add parsed items directly to the session's mediaItems.
                mediaItems: [
                    ...state.mediaItems.filter(item => item.originatingPlaylistId !== tempPlaylistId), 
                    ...parsedFileItems
                ],
                // isLoading will be set to false by fetchAndParsePlaylists
            }));
            await get().fetchAndParsePlaylists(true); // This will combine with other sources and set isLoading to false
        } catch (e: any) {
            console.error("Erro ao adicionar playlist de arquivo:", e);
            set({ isLoading: false, error: e.message || "Falha ao adicionar playlist de arquivo." });
        }
      },

      addPlaylist: async (playlistData) => {
        const { type, url, xcDns, xcUsername, xcPassword, name } = playlistData;

        if (type === 'm3u' && url && get().playlists.some(p => p.type === 'm3u' && p.url === url && p.source === 'url')) {
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
            source: 'url'
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
                } else if (data && (data as unknown as XCUserInfo).exp_date) { // Handle direct exp_date for some XC panels
                   const expiryTimestamp = parseInt((data as unknown as XCUserInfo).exp_date as string, 10);
                   if (!isNaN(expiryTimestamp)) {
                    newPlaylist.expiryDate = new Date(expiryTimestamp * 1000).toISOString();
                  }
                }
              }
            } catch (e: any) {
              console.warn(`Erro ao buscar data de validade para playlist XC ${xcDns}: ${e.message}`);
            }
          } else if (type === 'm3u' && !url){
             throw new Error("URL da playlist M3U não fornecida para playlist do tipo URL.");
          }

          set((state) => ({
            playlists: [...state.playlists, newPlaylist],
          }));
          await get().fetchAndParsePlaylists(true);
        } catch (e: any) {
          console.error("Erro no processo addPlaylist (URL/XC):", e);
          set({ isLoading: false, error: e.message || "Falha ao adicionar playlist URL/XC." });
        }
      },

      removePlaylist: (id: string) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
          mediaItems: state.mediaItems.filter(item => item.originatingPlaylistId !== id) // Also remove session items if a file-based playlist is removed
        }));
        get().fetchAndParsePlaylists(true); // Refresh from remaining URL sources
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
            // Only name changes are persisted for file playlists. Content is session-only.
        } else if (originalPlaylist.type === 'm3u' && originalPlaylist.url !== updatedPlaylist.url) {
          playlistNeedsContentRefresh = true;
        } else if (originalPlaylist.type === 'xc' && (
          originalPlaylist.xcDns !== updatedPlaylist.xcDns ||
          originalPlaylist.xcUsername !== updatedPlaylist.xcUsername ||
          originalPlaylist.xcPassword !== updatedPlaylist.xcPassword
        )) {
          playlistNeedsContentRefresh = true;
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
                    updatedPlaylist.expiryDate = undefined;
                }
              } else {
                updatedPlaylist.expiryDate = undefined;
              }
            } catch (e: any) {
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
          set ({ isLoading: false, error: null }); // Ensure error is cleared if no refresh
        }
      },

      fetchAndParsePlaylists: async (forceRefresh = false) => {
        const currentStoreState = get();
        // If not forcing, and items exist, and not loading, this might be a nav re-render.
        // However, onRehydrateStorage relies on this to fetch initial data.
        // The isLoading check helps prevent concurrent fetches.
        if (currentStoreState.isLoading && !forceRefresh) {
            console.log("StreamVerse: Fetch and parse already in progress, skipping.");
            return;
        }
        set({ isLoading: true, error: null });
        
        const currentPlaylists = get().playlists;
        // Get file-based items from the current session (were added by addPlaylistFromFileContent)
        // These are not re-parsed here, just carried over if they exist from current session uploads.
        const currentSessionFileItems = get().mediaItems.filter(mi => {
            const plDef = currentPlaylists.find(p => p.id === mi.originatingPlaylistId);
            return plDef && plDef.source === 'file';
        });
        
        if (currentPlaylists.filter(p => p.source === 'url').length === 0 && currentSessionFileItems.length === 0) {
          set({ mediaItems: [], isLoading: false, error: null });
          return;
        }
        
        let allParsedMediaItemsFromUrls: MediaItem[] = [];
        let encounteredErrors: string[] = [];

        const urlBasedPlaylistPromises = currentPlaylists
          .filter(p => p.source === 'url' && ((p.type === 'm3u' && p.url) || (p.type === 'xc' && p.xcDns)))
          .map(async (playlist) => {
            try {
              if (playlist.type === 'xc' && playlist.xcDns && playlist.xcUsername && playlist.xcPassword) {
                const m3uUrlToFetch = `${playlist.xcDns}/get.php?username=${playlist.xcUsername}&password=${playlist.xcPassword}&type=m3u_plus&output=m3u8`;
                return fetchAndParseM3UUrl(m3uUrlToFetch, playlist.id, playlist.name);
              } else if (playlist.type === 'm3u' && playlist.url) {
                return fetchAndParseM3UUrl(playlist.url, playlist.id, playlist.name);
              }
              return [];
            } catch (error: any) {
              const playlistIdentifier = playlist.name || playlist.id;
              console.warn(`StreamVerse: Falha ao processar playlist ${playlistIdentifier}:`, error);
              const reasonMessage = error instanceof Error ? error.message : String(error);
              encounteredErrors.push(`Erro ao carregar "${playlistIdentifier}": ${reasonMessage}`);
              return [];
            }
        });

        const results = await Promise.allSettled(urlBasedPlaylistPromises);
        results.forEach((result) => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                allParsedMediaItemsFromUrls.push(...result.value);
            }
        });
          
        const uniqueUrlMediaItems = Array.from(new Map(allParsedMediaItemsFromUrls.map(item => [item.id, item])).values());

        set({ 
          mediaItems: [...currentSessionFileItems, ...uniqueUrlMediaItems], 
          isLoading: false, 
          error: encounteredErrors.length > 0 ? encounteredErrors.join('; ') : null 
        });
      },

      setEpgUrl: async (url: string | null) => {
        set({ epgUrl: url, epgError: null, epgData: {} }); // Clear old EPG data
        if (url) {
          await get().fetchAndParseEpg(true);
        } else {
          set({ epgLoading: false }); // Ensure loading stops if URL is cleared
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
          let proxyErrorDetails = 'Could not retrieve specific error details from proxy.';
          
          if (!response.ok) {
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
                        proxyErrorDetails = `Proxy Response (non-JSON): ${textError.trim()}`;
                    }
                } catch (textReadError) { /* proxyErrorDetails remains as default */ }
            }
            const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;
            throw new Error(`Failed to fetch EPG from ${epgUrl} via proxy (${upstreamStatusDescription}). Proxy details: ${proxyErrorDetails}`);
          }
          
          const xmlString = await response.text();
          if (!xmlString.trim().startsWith('<')) { 
             const errorDetail = `EPG data from ${epgUrl} does not appear to be valid XML. Content started with: "${xmlString.substring(0, Math.min(50, xmlString.length))}"`;
             console.warn(errorDetail);
             // Don't throw here, let parser attempt and fail if truly invalid
          }

          const parsedEpgData = parseXMLTV(xmlString);
          set({ epgData: parsedEpgData, epgLoading: false, epgError: null });
        } catch (e: any) {
          console.error("StreamVerse: Error fetching or parsing EPG data:", e);
          set({ epgLoading: false, epgError: e.message || "An error occurred while processing EPG data." });
        }
      },
      resetAppState: () => {
        console.log("StreamVerse: Resetting application state.");
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
