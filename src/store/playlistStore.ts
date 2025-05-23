
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage, type PersistOptions } from 'zustand/middleware';
import type { PlaylistItem, MediaItem } from '@/types';
import { parseM3U } from '@/lib/m3u-parser';

interface PlaylistState {
  playlists: PlaylistItem[];
  mediaItems: MediaItem[]; // All media items from all playlists
  addPlaylist: (url: string) => Promise<void>;
  removePlaylist: (id: string) => void;
  fetchAndParsePlaylists: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
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

// Define the part of the state to persist
type PersistentPlaylistState = Pick<PlaylistState, 'playlists'>;

const persistOptions: PersistOptions<PlaylistState, PersistentPlaylistState> = {
  name: 'streamverse-playlists-storage',
  storage: createJSONStorage(() => getLocalStorage()),
  partialize: (state) => ({
    playlists: state.playlists, // Only persist the playlists array
  }),
};

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set, get) => ({
      playlists: [],
      mediaItems: [],
      isLoading: false,
      error: null,
      addPlaylist: async (url: string) => {
        if (get().playlists.some(p => p.url === url)) {
          set({ error: "Playlist URL already exists." });
          return;
        }
        set({ isLoading: true, error: null }); 
        try {
          const newPlaylist: PlaylistItem = {
            id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 7)}`,
            url,
            name: `Playlist ${get().playlists.length + 1}`, 
            addedAt: new Date().toISOString(),
          };
          set((state) => ({
            playlists: [...state.playlists, newPlaylist],
          }));
          // After adding, fetch and parse all playlists again.
          // This will also update mediaItems and handle isLoading/error states internally.
          await get().fetchAndParsePlaylists(); 
        } catch (e: any) { 
          console.error("Error in addPlaylist process:", e);
          set({ isLoading: false, error: e.message || "Failed to add playlist." });
        }
      },
      removePlaylist: (id: string) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
        }));
        // After removing, fetch and parse remaining playlists.
        // This ensures mediaItems are updated.
        set({ isLoading: true, error: null }); // Set loading for the re-parse
        get().fetchAndParsePlaylists();
      },
      fetchAndParsePlaylists: async () => {
        // Ensure isLoading is true if called, unless it's already true.
        if (!get().isLoading) { 
           set({ isLoading: true, error: null });
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
          
          // This set call is what was causing the quota error if mediaItems were persisted.
          // Now, mediaItems is just an in-memory state.
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
    }),
    persistOptions // Use the defined persistOptions
  )
);
