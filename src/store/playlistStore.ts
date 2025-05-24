
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
    source?: 'url' | 'file'; // Keep source for distinction, even if file content isn't persisted
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
      // Ensure fileContent is not persisted with the playlist definition
      const { fileContent, ...rest } = p;
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
        setTimeout(() => {
            const currentState = usePlaylistStore.getState();
            // Fetch for URL-based playlists. File-based playlists are session-only for content.
            if ((currentState.playlists.some(p => p.source !== 'file' && (p.url || p.xcDns))) && !currentState.isLoading) {
                 console.log("StreamVerse: Rehydrated URL/XC playlist definitions found, fetching media items.");
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

      parentalControlEnabled: true,
      setParentalControlEnabled: (enabled: boolean) => {
        set({ parentalControlEnabled: enabled });
        // Re-process media items with new filter state, will use in-memory items
        const currentMediaItems = get().mediaItems; // Get current in-memory items
        // This part is tricky, as fetchAndParsePlaylists rebuilds from URLs.
        // For now, let's rely on pages re-filtering. A full refresh might be needed
        // or fetchAndParsePlaylists needs to be smarter about re-applying filters
        // to existing in-memory items if only parental control changed.
        // For simplicity, we might trigger a full re-parse which now won't include file content.
        // OR, pages just re-filter their view based on the new parentalControlEnabled state.
        // The pages already use `applyParentalFilter` in their `useMemo` for display,
        // so changing `parentalControlEnabled` should trigger re-renders with correct filtering.
      },

      addPlaylistFromFileContent: async (fileContent: string, fileName: string) => {
        set({ isLoading: true, error: null });
        try {
            const tempPlaylistId = `${Date.now().toString()}-${Math.random().toString(36).substring(2, 7)}`;
            const playlistNameForItems = fileName.trim() || `Arquivo ${tempPlaylistId.substring(0, 6)}`;
            
            // Create a playlist definition *without* fileContent for storage
            const playlistDefinitionForStorage: PlaylistItem = {
                id: tempPlaylistId,
                type: 'm3u',
                name: playlistNameForItems,
                source: 'file', // Mark as file source
                // No fileContent here
                addedAt: new Date().toISOString(),
            };
            
            // Parse the file content for the current session
            const parsedFileItems = parseM3UContent(fileContent, tempPlaylistId, playlistNameForItems);

            set((state) => ({
                playlists: [...state.playlists, playlistDefinitionForStorage], // Add playlist definition (small)
                // Add parsed items directly to the session's mediaItems.
                mediaItems: [
                    ...state.mediaItems.filter(item => item.originatingPlaylistId !== tempPlaylistId), // Remove old if re-uploading same logical file
                    ...parsedFileItems
                ],
                isLoading: false, // Set loading to false AFTER items are processed for the file
                error: null,
            }));
            // No need to call fetchAndParsePlaylists here, as items are in memory for the session.
            // If other URL playlists needed refreshing, that would be a separate action.
        } catch (e: any) {
            console.error("Erro ao adicionar playlist de arquivo:", e);
            set({ isLoading: false, error: e.message || "Falha ao adicionar playlist de arquivo." });
        }
      },

      addPlaylist: async (playlistData) => {
        const { type, url, xcDns, xcUsername, xcPassword, name } = playlistData; // source is implicitly 'url' here

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
            source: 'url' // Explicitly for M3U URLs and XC
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
        const playlistToRemove = get().playlists.find(p => p.id === id);
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
          // If it was a file-based playlist, its items are session-only and will be removed from mediaItems
          // when fetchAndParsePlaylists runs next or implicitly by not being re-added.
          // To be explicit, we can filter mediaItems here:
          mediaItems: playlistToRemove && playlistToRemove.source === 'file'
            ? state.mediaItems.filter(item => item.originatingPlaylistId !== id)
            : state.mediaItems,
        }));
        // Refresh media items, which will now exclude items from the removed playlist
        // (whether URL or file based, as file-based won't be re-added from a persisted source)
        get().fetchAndParsePlaylists(true);
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
        // Ensure fileContent is not part of updates to be persisted
        const { fileContent, ...safeUpdates } = updates;
        const updatedPlaylist = { ...originalPlaylist, ...safeUpdates };


        if (originalPlaylist.source === 'file') {
            // Only name changes are persisted for file playlists. Content is session-only.
            // No content refresh needed from URL as it's a file.
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
          set ({ isLoading: false });
        }
      },

      fetchAndParsePlaylists: async (forceRefresh = false) => {
        const currentStoreState = get();
        if (!forceRefresh && currentStoreState.mediaItems.length > 0 && !currentStoreState.isLoading) {
           // If not forcing, and items exist, and not loading, assume valid session state.
           // This is mainly to prevent re-fetch on simple navigation if not needed.
           // On app load, onRehydrateStorage will trigger this.
           // return; // Commented out to ensure it runs if called, e.g. after parental control change.
        }

        set({ isLoading: true, error: null });
        
        const currentPlaylists = get().playlists;
        if (currentPlaylists.length === 0) {
          set({ mediaItems: [], isLoading: false, error: null });
          return;
        }
        
        let allParsedMediaItemsFromUrls: MediaItem[] = [];
        let encounteredErrors: string[] = [];

        const urlBasedPlaylistPromises = currentPlaylists
          .filter(p => (p.type === 'm3u' && p.url && p.source === 'url') || (p.type === 'xc' && p.xcDns))
          .map(async (playlist) => {
            try {
              if (playlist.type === 'xc' && playlist.xcDns && playlist.xcUsername && playlist.xcPassword) {
                const m3uUrlToFetch = `${playlist.xcDns}/get.php?username=${playlist.xcUsername}&password=${playlist.xcPassword}&type=m3u_plus&output=m3u8`;
                return fetchAndParseM3UUrl(m3uUrlToFetch, playlist.id, playlist.name);
              } else if (playlist.type === 'm3u' && playlist.url && playlist.source === 'url') {
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

        // Preserve existing file-based items from the current session's mediaItems
        // These were added during upload and are not re-parsed from localStorage content.
        const existingFileBasedMediaItems = get().mediaItems.filter(mi => {
            const plDef = currentPlaylists.find(p => p.id === mi.originatingPlaylistId);
            return plDef && plDef.source === 'file';
        });
          
        const uniqueUrlMediaItems = Array.from(new Map(allParsedMediaItemsFromUrls.map(item => [item.id, item])).values());

        set({ 
          mediaItems: [...existingFileBasedMediaItems, ...uniqueUrlMediaItems], 
          isLoading: false, 
          error: encounteredErrors.length > 0 ? encounteredErrors.join('; ') : null 
        });
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
            let proxyErrorDetails = 'Could not retrieve specific error details from proxy.';
             try {
                const errorData = await response.json();
                proxyErrorDetails = errorData.error || proxyErrorDetails;
            } catch (e) {
                try {
                    const textError = await response.text();
                    proxyErrorDetails = textError || proxyErrorDetails;
                } catch (textReadError) {}
            }
            const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;
            throw new Error(`Failed to fetch EPG from ${epgUrl} via proxy (${upstreamStatusDescription}). Proxy: ${proxyErrorDetails}`);
          }
          
          const xmlString = await response.text();
          if (!xmlString.trim().startsWith('<')) { 
             console.warn(`EPG data from ${epgUrl} does not appear to be valid XML.`);
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

