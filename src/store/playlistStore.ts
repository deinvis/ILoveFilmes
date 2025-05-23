
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage, type PersistOptions } from 'zustand/middleware';
import type { PlaylistItem, MediaItem, EpgProgram } from '@/types';
import { parseM3U } from '@/lib/m3u-parser';
import { parseXMLTV } from '@/lib/xmltv-parser';

interface PlaylistState {
  playlists: PlaylistItem[];
  mediaItems: MediaItem[];
  addPlaylist: (url: string) => Promise<void>;
  removePlaylist: (id: string) => void;
  fetchAndParsePlaylists: (forceRefresh?: boolean) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  
  epgUrl: string | null;
  epgData: Record<string, EpgProgram[]>; // Maps tvg-id to its programs
  epgLoading: boolean;
  epgError: string | null;
  setEpgUrl: (url: string | null) => Promise<void>;
  fetchAndParseEpg: (forceRefresh?: boolean) => Promise<void>;
}

const getLocalStorage = () => {
  if (typeof window !== 'undefined') {
    return localStorage;
  }
  // Return a mock storage for SSR or environments where localStorage is not available
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
};

// Define what parts of the state to persist
type PersistentPlaylistState = Pick<PlaylistState, 'playlists' | 'epgUrl'>;


const persistOptions: PersistOptions<PlaylistState, PersistentPlaylistState> = {
  name: 'streamverse-storage', 
  storage: createJSONStorage(() => getLocalStorage()),
  partialize: (state) => ({
    playlists: state.playlists,
    epgUrl: state.epgUrl,
    // mediaItems and epgData are not persisted to avoid localStorage quota issues
  }),
   onRehydrateStorage: (state) => {
    console.log("Hydration starts");
    return (rehydratedState, error) => {
      if (error) {
        console.error("Failed to rehydrate state from localStorage:", error);
      } else {
        console.log("Successfully rehydrated state:", rehydratedState);
         if (rehydratedState) {
          // Trigger initial fetches after rehydration if necessary
          // Note: fetchAndParsePlaylists might be called by components too
          // This ensures EPG is fetched if URL was persisted
          if (rehydratedState.epgUrl) {
             Promise.resolve().then(() => { // Ensure it runs after current event loop
                usePlaylistStore.getState().fetchAndParseEpg();
             });
          }
        }
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

      addPlaylist: async (url: string) => {
        if (get().playlists.some(p => p.url === url)) {
          set({ error: "Playlist URL already exists." });
          // Consider not returning here and letting fetchAndParsePlaylists handle error display
          // For now, this provides immediate feedback.
          return;
        }
        try {
          const newPlaylist: PlaylistItem = {
            id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 7)}`,
            url,
            name: `Playlist ${get().playlists.length + 1}`, 
            addedAt: new Date().toISOString(),
          };
          set((state) => ({
            playlists: [...state.playlists, newPlaylist],
            error: null, 
          }));
          await get().fetchAndParsePlaylists(true); 
        } catch (e: any) { 
          console.error("Error in addPlaylist process:", e);
          // Error state will be set by fetchAndParsePlaylists
        }
      },
      removePlaylist: (id: string) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
          // Also clear media items that originated from this playlist
          mediaItems: state.mediaItems.filter(item => !item.id.startsWith(id)) 
        }));
        // No need to force refresh if we manually cleared relevant mediaItems
        // However, a full refresh ensures consistency if other logic depends on it.
        // For simplicity and to ensure all related data is re-evaluated:
        get().fetchAndParsePlaylists(true); 
      },
      fetchAndParsePlaylists: async (forceRefresh = false) => {
        if (!forceRefresh && get().mediaItems.length > 0 && !get().isLoading) {
          console.log("Using in-session media items.");
          return;
        }

        console.log(forceRefresh ? "Forcing refresh of media items." : "Cache empty or refresh needed, fetching media items.");
        set({ isLoading: true, error: null });
        
        const currentPlaylists = get().playlists;
        let allMediaItems: MediaItem[] = [];
        let encounteredErrors: string[] = [];

        try {
          if (currentPlaylists.length === 0) {
            set({ mediaItems: [], isLoading: false, error: null });
            return;
          }

          const results = await Promise.allSettled(
            currentPlaylists.map(playlist => parseM3U(playlist.url, playlist.id))
          );

          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              allMediaItems = [...allMediaItems, ...result.value];
            } else {
              const playlistUrl = currentPlaylists[index]?.url || 'Unknown URL';
              const playlistName = currentPlaylists[index]?.name || playlistUrl.substring(0,30)+'...';
              console.error(`Failed to parse playlist ${playlistName} (${playlistUrl}):`, result.reason);
              const reasonMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
              encounteredErrors.push(`Error loading "${playlistName}": ${reasonMessage}`);
            }
          });
          
          set({ 
            mediaItems: allMediaItems, 
            isLoading: false, 
            error: encounteredErrors.length > 0 ? encounteredErrors.join('; ') : null 
          });

        } catch (e: any) { 
          console.error("Unexpected error in fetchAndParsePlaylists:", e);
          set({ isLoading: false, error: e.message || "An unexpected error occurred while loading media items." });
        }
      },

      setEpgUrl: async (url: string | null) => {
        set({ epgUrl: url, epgError: null, epgData: {} }); // Clear previous EPG errors and data
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
          console.log("Using in-session EPG data.");
          return;
        }
        
        console.log(forceRefresh ? "Forcing refresh of EPG data." : "EPG data empty or refresh needed.");
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
                    // if response.text() also fails
                    proxyErrorDetails = 'Proxy did not return a JSON response, and its body was unreadable as text.';
                }
            }
            const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;
            throw new Error(`Failed to fetch EPG from ${epgUrl} via proxy (${upstreamStatusDescription}). Proxy: ${proxyErrorDetails}`);
          }
          
          const contentType = response.headers.get('content-type');
          if (contentType && !(contentType.includes('xml') || contentType.includes('application/octet-stream'))) {
            const errorDetail = `EPG source at ${epgUrl} did not return XML data. Received content type: ${contentType}. Please ensure the URL points to a valid XMLTV file.`;
            console.warn(errorDetail);
            throw new Error(errorDetail);
          }
          
          const xmlString = await response.text();
          if (!xmlString.trim().startsWith('<')) { // Basic check if it even looks like XML
             const errorDetail = `EPG data from ${epgUrl} does not appear to be valid XML (does not start with '<'). Please check the EPG URL.`;
             console.warn(errorDetail + " Content received: " + xmlString.substring(0,100) + "...");
             throw new Error(errorDetail);
          }

          const parsedEpgData = parseXMLTV(xmlString);
          set({ epgData: parsedEpgData, epgLoading: false });
        } catch (e: any) {
          console.error("Error fetching or parsing EPG data:", e);
          set({ epgLoading: false, epgError: e.message || "An error occurred while processing EPG data." });
        }
      },
    }),
    persistOptions
  )
);

// Initial fetch for playlists after store is created and potentially rehydrated
// This ensures playlists are loaded if the app is opened directly to a page
// that relies on playlist data.
if (typeof window !== 'undefined') {
  Promise.resolve().then(() => { // Ensure it runs after initial hydration attempt
    usePlaylistStore.getState().fetchAndParsePlaylists();
    // EPG fetch is handled by onRehydrateStorage or setEpgUrl
  });
}
