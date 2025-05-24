
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage, type PersistOptions } from 'zustand/middleware';
import type { PlaylistItem, MediaItem, EpgProgram, StartPagePath, RecentlyPlayedItem, PlaybackProgressData, PlaylistType, XCAPIResponse, XCUserInfo, PersistentPlaylistState, PlaylistState as PlaylistStateType } from '@/types';
import { parseM3UContent, fetchAndParseM3UUrl } from '@/lib/m3u-parser';
import { parseXMLTV } from '@/lib/xmltv-parser';

const MAX_RECENTLY_PLAYED_ITEMS = 10;
const MAX_PLAYBACK_PROGRESS_ENTRIES = 200;
const DEFAULT_START_PAGE: StartPagePath = '/app/channels';

const getLocalStorage = () => {
  if (typeof window !== 'undefined') {
    return localStorage;
  }
  // Fallback for SSR or environments where localStorage is not available
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  } as unknown as Storage; // Cast to Storage to satisfy createJSONStorage type
};

const persistOptions: PersistOptions<PlaylistStateType, PersistentPlaylistState> = {
  name: 'streamverse-storage',
  storage: createJSONStorage(() => getLocalStorage()),
  partialize: (state) => ({
    playlists: state.playlists.map(p => {
      // Ensure fileContent is NOT persisted within playlists array
      const { ...rest } = p;
      // @ts-ignore - Dynamically removing property for persistence
      delete rest.fileContent; 
      return rest;
    }),
    epgUrl: state.epgUrl,
    preferredStartPage: state.preferredStartPage,
    favoriteItemIds: state.favoriteItemIds,
    playbackProgress: state.playbackProgress,
    recentlyPlayed: state.recentlyPlayed,
    parentalControlEnabled: state.parentalControlEnabled,
    fileBasedMediaItems: state.fileBasedMediaItems,
    manuallyWatchedItemIds: state.manuallyWatchedItemIds, // Persist this
  }),
   onRehydrateStorage: () => {
    console.log("StreamVerse: Hydration from localStorage has started.");
    return (_rehydratedState, error) => {
      if (error) {
        console.error("StreamVerse: Failed to rehydrate state from localStorage:", error);
      } else {
        console.log("StreamVerse: Successfully rehydrated state from localStorage.");
        // Defer execution to allow the store to fully initialize
        setTimeout(() => {
            const currentState = usePlaylistStore.getState();
             console.log("StreamVerse: State after rehydration:", {
              playlistsCount: currentState.playlists.length,
              persistedFileBasedMediaItemsCount: currentState.fileBasedMediaItems?.length || 0,
              sessionMediaItemsCount: currentState.mediaItems.length,
              isLoading: currentState.isLoading,
            });
            if (currentState.playlists.length > 0 || currentState.fileBasedMediaItems.length > 0) {
                 console.log("StreamVerse: Rehydrated playlist definitions or file items found, (re)processing all playlists.");
                 currentState.fetchAndParsePlaylists(true);
            } else if (currentState.isLoading) {
                console.log("StreamVerse: Rehydration occurred while store was already in a loading state.");
            } else {
                console.log("StreamVerse: No playlist definitions or file items found after rehydration.");
            }

            if (currentState.epgUrl && Object.keys(currentState.epgData).length === 0 && !currentState.epgLoading) {
              console.log("StreamVerse: Rehydrated EPG URL found, fetching initial EPG data.");
              currentState.fetchAndParseEpg(true); 
            }
        }, 0);
      }
    };
  },
};

export const usePlaylistStore = create<PlaylistStateType>()(
  persist(
    (set, get) => ({
      playlists: [],
      mediaItems: [], 
      fileBasedMediaItems: [], // Persisted for uploaded file content
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
        if (duration > 0 && currentTime > 5 && currentTime / duration < 0.95) { // Only save if meaningful progress and not near end
          set(state => {
            const newProgress = { ...state.playbackProgress };
            newProgress[itemId] = { currentTime, duration, lastUpdatedAt: Date.now() };

            // LRU cache logic for playbackProgress
            const progressKeys = Object.keys(newProgress);
            if (progressKeys.length > MAX_PLAYBACK_PROGRESS_ENTRIES) {
              // Sort keys by lastUpdatedAt (oldest first)
              const sortedKeys = progressKeys.sort((a, b) => newProgress[a].lastUpdatedAt - newProgress[b].lastUpdatedAt);
              const keysToRemoveCount = sortedKeys.length - MAX_PLAYBACK_PROGRESS_ENTRIES;
              for (let i = 0; i < keysToRemoveCount; i++) {
                delete newProgress[sortedKeys[i]];
              }
            }
            return { playbackProgress: newProgress };
          });
        } else if (duration > 0 && currentTime / duration >= 0.95) { // If watched till near end, clear progress
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
        get().fetchAndParsePlaylists(true);
      },

      manuallyWatchedItemIds: [],
      toggleManuallyWatched: (itemId: string) => {
        set((state) => {
          const isCurrentlyWatched = state.manuallyWatchedItemIds.includes(itemId);
          if (isCurrentlyWatched) {
            return { manuallyWatchedItemIds: state.manuallyWatchedItemIds.filter(id => id !== itemId) };
          } else {
            // Optionally, when marking as watched, clear playback progress for this item
            // const newProgress = { ...state.playbackProgress };
            // delete newProgress[itemId];
            return { 
              manuallyWatchedItemIds: [...state.manuallyWatchedItemIds, itemId],
              // playbackProgress: newProgress 
            };
          }
        });
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
                addedAt: new Date().toISOString(),
                // Do NOT store fileContent here for persistence reasons
            };
            
            const parsedFileItems = parseM3UContent(fileContent, tempPlaylistId, playlistNameForItems);
            console.log(`Parsed ${parsedFileItems.length} items from uploaded file "${fileName}"`);

            set((state) => ({
                playlists: [...state.playlists, newPlaylist], // Add playlist definition
                // Add new file items to the persisted fileBasedMediaItems
                fileBasedMediaItems: [
                  ...state.fileBasedMediaItems.filter(item => item.originatingPlaylistId !== tempPlaylistId), // Remove old items for this file if re-uploading
                  ...parsedFileItems
                ],
            }));
            await get().fetchAndParsePlaylists(true); // This will combine with URL sources & set isLoading: false
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
                } else if (data && (data as unknown as XCUserInfo).exp_date) { // Handle cases where user_info might be missing
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
          fileBasedMediaItems: playlistToRemove && playlistToRemove.source === 'file'
            ? state.fileBasedMediaItems.filter(item => item.originatingPlaylistId !== id)
            : state.fileBasedMediaItems,
        }));
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
        const updatedPlaylist = { ...originalPlaylist, ...updates };

        if (originalPlaylist.source === 'file') {
            // For file playlists, only name can be updated. Content is not re-fetched.
            // If name changed, nothing content-wise needs refresh.
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
                    updatedPlaylist.expiryDate = undefined; // Clear if not found
                }
              } else {
                updatedPlaylist.expiryDate = undefined; // Clear on error
              }
            } catch (e: any) {
              console.warn(`Erro ao buscar data de validade para playlist XC editada ${updatedPlaylist.xcDns}: ${e.message}`);
              updatedPlaylist.expiryDate = undefined; // Clear on error
            }
          }
        }

        const newPlaylists = [...originalPlaylists];
        newPlaylists[playlistIndex] = updatedPlaylist;
        set({ playlists: newPlaylists });

        if (playlistNeedsContentRefresh) {
          await get().fetchAndParsePlaylists(true);
        } else {
          // If only the name changed or it was a file playlist name change, no full content refresh needed.
          set ({ isLoading: false, error: null });
        }
      },

      fetchAndParsePlaylists: async (forceRefresh = false) => {
        if (get().isLoading && !forceRefresh) {
            console.log("StreamVerse: fetchAndParsePlaylists skipped, already loading and not forced.");
            return;
        }
        set({ isLoading: true, error: null });

        const currentStoreState = get();
        console.log("StreamVerse: fetchAndParsePlaylists called. Force refresh:", forceRefresh);
        console.log("StreamVerse: Initial state for fetch - isLoading (before set):", currentStoreState.isLoading, "Playlists defs count:", currentStoreState.playlists.length, "Persisted File Items count:", currentStoreState.fileBasedMediaItems?.length || 0);


        const currentPlaylistDefinitions = currentStoreState.playlists; 
        const currentPersistedFileItems = currentStoreState.fileBasedMediaItems || [];

        if (currentPlaylistDefinitions.filter(p => p.source === 'url' && ((p.type === 'm3u' && p.url) || (p.type === 'xc' && p.xcDns))).length === 0 && currentPersistedFileItems.length === 0) {
          set({ mediaItems: [], isLoading: false, error: null });
          console.log("StreamVerse: No URL playlists and no persisted file items to process.");
          return;
        }

        let allParsedMediaItemsFromUrls: MediaItem[] = [];
        let encounteredErrors: string[] = [];

        const urlBasedPlaylistPromises = currentPlaylistDefinitions
          .filter(p => p.source === 'url' && ((p.type === 'm3u' && p.url) || (p.type === 'xc' && p.xcDns)))
          .map(async (playlist) => {
            try {
              if (playlist.type === 'xc' && playlist.xcDns && playlist.xcUsername && playlist.xcPassword) {
                // For XC, always use m3u8 output for HLS.js compatibility
                const m3uUrlToFetch = `${playlist.xcDns}/get.php?username=${playlist.xcUsername}&password=${playlist.xcPassword}&type=m3u_plus&output=m3u8`;
                return fetchAndParseM3UUrl(m3uUrlToFetch, playlist.id, playlist.name);
              } else if (playlist.type === 'm3u' && playlist.url) {
                return fetchAndParseM3UUrl(playlist.url, playlist.id, playlist.name);
              }
              return []; // Should not happen if filter is correct
            } catch (error: any) {
              const playlistIdentifier = playlist.name || playlist.id;
              console.warn(`StreamVerse: Falha ao processar playlist URL/XC ${playlistIdentifier}:`, error);
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
            // Errors from individual playlist fetches are already handled and pushed to encounteredErrors
        });
        
        // Deduplicate items from URL sources (based on ID)
        const uniqueUrlMediaItems = Array.from(new Map(allParsedMediaItemsFromUrls.map(item => [item.id, item])).values());

        // Combine persisted file items with freshly fetched URL items
        // Ensure items from fileBasedMediaItems are not duplicated if somehow they also came from a URL
        // (though this shouldn't happen if IDs are playlist-specific)
        const combinedMediaItemsMap = new Map<string, MediaItem>();
        currentPersistedFileItems.forEach(item => combinedMediaItemsMap.set(item.id, item));
        uniqueUrlMediaItems.forEach(item => combinedMediaItemsMap.set(item.id, item)); // Overwrites file item if same ID from URL

        const finalCombinedMediaItems = Array.from(combinedMediaItemsMap.values());
        
        console.log(`StreamVerse: fetchAndParsePlaylists completed. Total combined media items in session: ${finalCombinedMediaItems.length}. From persisted files: ${currentPersistedFileItems.length}, From URLs: ${uniqueUrlMediaItems.length}`);

        set({
          mediaItems: finalCombinedMediaItems, 
          isLoading: false,
          error: encounteredErrors.length > 0 ? encounteredErrors.join('; ') : null
        });
      },

      setEpgUrl: async (url: string | null) => {
        set({ epgUrl: url, epgError: null, epgData: {} });
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
          console.log("StreamVerse: EPG fetch skipped, data exists and not forced.");
          return;
        }
        set({ epgLoading: true, epgError: null });
        try {
          const proxyApiUrl = `/api/proxy?url=${encodeURIComponent(epgUrl)}`;
          const response = await fetch(proxyApiUrl);
          let proxyErrorDetails = 'Não foi possível recuperar detalhes específicos do erro do proxy.';

          if (!response.ok) {
             try {
                const errorData = await response.json();
                if (errorData && typeof errorData.error === 'string') {
                     proxyErrorDetails = errorData.error;
                } else if (errorData) { // Handle cases where errorData might not be an object with .error
                    proxyErrorDetails = `Proxy retornou um formato de erro JSON inesperado: ${JSON.stringify(errorData)}`;
                }
            } catch (e) {
                try {
                    const textError = await response.text(); // Attempt to get text error if JSON parsing fails
                    if (textError && textError.trim() !== '') {
                        proxyErrorDetails = `Resposta do Proxy (não-JSON): ${textError.trim()}`;
                    }
                } catch (textReadError) { /* proxyErrorDetails remains as default */ }
            }
            const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;
            throw new Error(`Falha ao buscar EPG de ${epgUrl} via proxy (${upstreamStatusDescription}). Detalhes do proxy: ${proxyErrorDetails}`);
          }
          
          const xmlString = await response.text();
          // Basic check if string starts with '<', more robust parsing in parseXMLTV
          if (!xmlString.trim().startsWith('<')) {
             const errorDetail = `EPG data from ${epgUrl} does not appear to be valid XML. Content started with: "${xmlString.substring(0, Math.min(50, xmlString.length))}"`;
             console.warn(errorDetail);
             // Do not throw, let parser handle it.
          }

          const parsedEpgData = parseXMLTV(xmlString);
          set({ epgData: parsedEpgData, epgLoading: false, epgError: null });
        } catch (e: any) {
          console.error("StreamVerse: Error fetching or parsing EPG data:", e);
          set({ epgLoading: false, epgError: e.message || "Ocorreu um erro ao processar os dados do EPG." });
        }
      },
      resetAppState: () => {
        console.log("StreamVerse: Resetting application state.");
        // Clear localStorage directly for the persisted store
        getLocalStorage().removeItem(persistOptions.name as string);
        // Reset in-memory state to defaults
        set({
          playlists: [],
          mediaItems: [],
          fileBasedMediaItems: [], 
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
          manuallyWatchedItemIds: [],
          parentalControlEnabled: true,
        });
      },
    }),
    persistOptions
  )
);
