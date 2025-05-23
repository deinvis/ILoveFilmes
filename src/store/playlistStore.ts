
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
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
};

type PersistentPlaylistState = Pick<PlaylistState, 'playlists' | 'epgUrl'>;

const persistOptions: PersistOptions<PlaylistState, PersistentPlaylistState> = {
  name: 'streamverse-storage', // Renamed to avoid conflict if old data exists
  storage: createJSONStorage(() => getLocalStorage()),
  partialize: (state) => ({
    playlists: state.playlists,
    epgUrl: state.epgUrl, // Persist EPG URL
    // mediaItems and epgData will not be persisted
  }),
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
            error: null, // Clear previous errors
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
        }));
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
        set({ epgUrl: url, epgError: null }); // Clear previous EPG errors
        if (url) {
          await get().fetchAndParseEpg(true); // Force fetch and parse new EPG
        } else {
          set({ epgData: {}, epgLoading: false }); // Clear EPG data if URL is removed
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
                const textError = await response.text();
                proxyErrorDetails = textError || proxyErrorDetails;
            }
            const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;
            throw new Error(`Failed to fetch EPG from ${epgUrl} via proxy (${upstreamStatusDescription}). Proxy: ${proxyErrorDetails}`);
          }
          
          const xmlString = await response.text();
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

// Initial fetch for playlists and EPG if URLs are persisted from previous session
if (typeof window !== 'undefined') {
  usePlaylistStore.getState().fetchAndParsePlaylists();
  if (usePlaylistStore.getState().epgUrl) {
    usePlaylistStore.getState().fetchAndParseEpg();
  }
}
