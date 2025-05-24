
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage, type PersistOptions } from 'zustand/middleware';
import type { PlaylistItem, MediaItem, EpgProgram, StartPagePath, RecentlyPlayedItem, PlaybackProgressData } from '@/types';
import { parseM3U } from '@/lib/m3u-parser';
import { parseXMLTV } from '@/lib/xmltv-parser';

const MAX_RECENTLY_PLAYED_ITEMS = 20;
const DEFAULT_START_PAGE: StartPagePath = '/app/channels';

interface PlaylistState {
  playlists: PlaylistItem[];
  mediaItems: MediaItem[]; // Will not be persisted
  addPlaylist: (url: string, name?: string) => Promise<void>;
  removePlaylist: (id: string) => void;
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
  // Provide a mock storage for SSR or environments where localStorage is not available
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
};

// Define which parts of the state to persist
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
        // Defer store actions until after initial hydration and component mount
        setTimeout(() => {
            const currentState = usePlaylistStore.getState();
            const { playlists, mediaItems, epgUrl, epgData } = currentState;
            
            if (playlists.length > 0 && mediaItems.length === 0) {
                 console.log("StreamVerse: Rehydrated playlists found, fetching initial media items.");
                 currentState.fetchAndParsePlaylists();
            }
            if (epgUrl && Object.keys(epgData).length === 0) {
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
      mediaItems: [], // Not persisted
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
            delete newProgress[itemId]; // Remove progress if watched to near completion
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

      addPlaylist: async (url: string, name?: string) => {
        if (get().playlists.some(p => p.url === url)) {
          const errorMsg = `Playlist URL "${url}" already exists.`;
          set({ error: errorMsg });
          console.warn(errorMsg);
          return;
        }
        
        set({ isLoading: true, error: null }); 
        
        try {
          const newPlaylist: PlaylistItem = {
            id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 7)}`, 
            url,
            name: name || `Playlist ${get().playlists.length + 1}`, 
            addedAt: new Date().toISOString(),
          };
          set((state) => ({
            playlists: [...state.playlists, newPlaylist],
          }));
          await get().fetchAndParsePlaylists(true); 
        } catch (e: any) { 
          console.error("Error in addPlaylist process:", e);
          set({ isLoading: false, error: e.message || "Failed to add playlist." });
        }
      },
      removePlaylist: (id: string) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
          mediaItems: state.mediaItems.filter(item => item.originatingPlaylistId !== id) // Also remove items from this playlist
        }));
        // No need to call fetchAndParsePlaylists here if we manually remove items,
        // unless there's a desire to re-evaluate duplicates from remaining lists.
        // For simplicity now, we'll just remove them.
        // If full re-parse is needed: get().fetchAndParsePlaylists(true);
      },
      fetchAndParsePlaylists: async (forceRefresh = false) => {
        if (!forceRefresh && get().mediaItems.length > 0 && !get().isLoading) {
          console.log("StreamVerse: Using in-session media items.");
          return;
        }

        console.log(forceRefresh ? "StreamVerse: Forcing refresh of media items." : "StreamVerse: Cache empty or refresh needed, fetching media items.");
        set({ isLoading: true, error: null, mediaItems: forceRefresh ? [] : get().mediaItems }); 
        
        const currentPlaylists = get().playlists;
        let allMediaItems: MediaItem[] = [];
        let encounteredErrors: string[] = [];

        try {
          if (currentPlaylists.length === 0) {
            console.log("StreamVerse: No playlists to fetch from.");
            set({ mediaItems: [], isLoading: false, error: null });
            return;
          }

          const results = await Promise.allSettled(
            currentPlaylists.map(playlist => parseM3U(playlist.url, playlist.id, playlist.name))
          );

          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              allMediaItems = [...allMediaItems, ...result.value];
            } else {
              const playlistIdentifier = currentPlaylists[index]?.name || currentPlaylists[index]?.url || `Playlist at index ${index}`;
              console.error(`StreamVerse: Failed to parse playlist ${playlistIdentifier}:`, result.reason);
              const reasonMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
              encounteredErrors.push(`Error loading "${playlistIdentifier}": ${reasonMessage}`);
            }
          });
          
          console.log(`StreamVerse: Successfully parsed ${allMediaItems.length} media items from ${currentPlaylists.length} playlist(s).`);
          set({ 
            mediaItems: allMediaItems, 
            isLoading: false, 
            error: encounteredErrors.length > 0 ? encounteredErrors.join('; ') : null 
          });

        } catch (e: any) { 
          console.error("StreamVerse: Unexpected error in fetchAndParsePlaylists:", e);
          set({ isLoading: false, error: e.message || "An unexpected error occurred while loading media items." });
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
          console.log("StreamVerse: Using in-session EPG data.");
          return;
        }
        
        console.log(forceRefresh ? "StreamVerse: Forcing refresh of EPG data." : "StreamVerse: EPG data empty or refresh needed.");
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
                } catch (textReadError) {
                    proxyErrorDetails = 'Proxy did not return a JSON response, and its body was unreadable as text.';
                }
            }
            const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;
            throw new Error(`Failed to fetch EPG from ${epgUrl} via proxy (${upstreamStatusDescription}). Proxy: ${proxyErrorDetails}`);
          }
          
          const xmlString = await response.text();
          
           if (!xmlString.trim().startsWith('<')) { 
             const errorDetail = `EPG data from ${epgUrl} does not appear to be valid XML (does not start with '<'). Please check the EPG URL. Content received (first 100 chars): ${xmlString.substring(0,100)}...`;
             console.warn(errorDetail);
             throw new Error(errorDetail); 
          }

          const parsedEpgData = parseXMLTV(xmlString); 
          console.log(`StreamVerse: Successfully parsed EPG data from ${epgUrl}, found programs for ${Object.keys(parsedEpgData).length} channels.`);
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
          mediaItems: [], // Also clear in-memory items
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
      },
    }),
    persistOptions
  )
);

if (typeof window !== 'undefined') {
  console.log("StreamVerse: Initial store state before rehydration:", usePlaylistStore.getState());
}
