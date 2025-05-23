
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
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
          // The UI component (PlaylistManager) will show a toast based on this error state
          return;
        }
        set({ isLoading: true, error: null }); // Set loading true for the whole add operation
        try {
          // Basic naming, can be improved if playlist itself has a name (e.g. from X-TVG-URL header)
          const newPlaylist: PlaylistItem = {
            id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 7)}`, // More unique ID
            url,
            name: `Playlist ${get().playlists.length + 1}`, 
            addedAt: new Date().toISOString(),
          };
          set((state) => ({
            playlists: [...state.playlists, newPlaylist],
          }));
          await get().fetchAndParsePlaylists(); // Reparse all playlists. This will set isLoading to false and handle its own errors.
        } catch (e: any) { 
          // This catch is primarily for unexpected errors during the playlist object creation/storage
          // or if fetchAndParsePlaylists itself throws an unhandled error (though it should set its own error state).
          console.error("Error in addPlaylist process:", e);
          set({ isLoading: false, error: e.message || "Failed to add playlist." });
        }
      },
      removePlaylist: (id: string) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
          isLoading: true, // Set loading true for the re-parse operation
          error: null,
        }));
        get().fetchAndParsePlaylists(); // Reparse remaining playlists
      },
      fetchAndParsePlaylists: async () => {
        if (!get().isLoading) { // Ensure isLoading is true if called directly
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
              console.error(`Failed to parse playlist ${playlistUrl}:`, result.reason);
              // Use a more concise error message for the UI
              const reasonMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
              encounteredErrors.push(`Error loading "${currentPlaylists[index]?.name || playlistUrl.substring(0,30)+'...'}": ${reasonMessage}`);
            }
          });
          
          set({ 
            mediaItems: allMediaItems, 
            isLoading: false, 
            error: encounteredErrors.length > 0 ? encounteredErrors.join('; ') : null 
          });

        } catch (e: any) { // Catch for truly unexpected errors in this function's logic
          console.error("Unexpected error in fetchAndParsePlaylists:", e);
          set({ isLoading: false, error: e.message || "An unexpected error occurred while loading media items." });
        }
      },
    }),
    {
      name: 'streamverse-playlists-storage',
      storage: createJSONStorage(() => getLocalStorage()),
    }
  )
);
