"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PlaylistItem, MediaItem } from '@/types';
import { parseM3U } from '@/lib/m3u-parser'; // We'll create this parser

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
          // In a real app, you might fetch here to validate/get a name
          // For now, just add it
          const newPlaylist: PlaylistItem = {
            id: Date.now().toString(),
            url,
            name: `Playlist ${get().playlists.length + 1}`, // Basic naming
            addedAt: new Date().toISOString(),
          };
          set((state) => ({
            playlists: [...state.playlists, newPlaylist],
            isLoading: false,
          }));
          await get().fetchAndParsePlaylists(); // Reparse all playlists
        } catch (e) {
          set({ isLoading: false, error: "Failed to add playlist." });
          console.error(e);
        }
      },
      removePlaylist: (id: string) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
        }));
        get().fetchAndParsePlaylists(); // Reparse remaining playlists
      },
      fetchAndParsePlaylists: async () => {
        set({ isLoading: true, error: null });
        const currentPlaylists = get().playlists;
        let allMediaItems: MediaItem[] = [];
        try {
          for (const playlist of currentPlaylists) {
            // In a real app, you would fetch the content of playlist.url here
            // const response = await fetch(playlist.url);
            // if (!response.ok) throw new Error(`Failed to fetch ${playlist.url}`);
            // const m3uString = await response.text();
            // const items = parseM3U(m3uString);
            
            // For now, use mock parser with the URL itself (as it's not fetching)
            const items = parseM3U(playlist.url, playlist.id); // Pass playlist ID for context
            allMediaItems = [...allMediaItems, ...items];
          }
          set({ mediaItems: allMediaItems, isLoading: false });
        } catch (e) {
          console.error("Error fetching or parsing playlists:", e);
          set({ isLoading: false, error: "Failed to load media items from playlists." });
        }
      },
    }),
    {
      name: 'streamverse-playlists-storage', // unique name
      storage: createJSONStorage(() => getLocalStorage()),
    }
  )
);

// Initial fetch when the app loads and store is hydrated
if (typeof window !== 'undefined') {
    usePlaylistStore.getState().fetchAndParsePlaylists();
}
