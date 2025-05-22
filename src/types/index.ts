export type MediaType = 'channel' | 'movie' | 'series';

export interface PlaylistItem {
  id: string;
  url: string;
  name?: string; // Optional name for the playlist
  addedAt: string;
}

export interface MediaItem {
  id: string;
  type: MediaType;
  title: string;
  posterUrl?: string;
  streamUrl: string;
  description?: string;
  genre?: string;
  groupTitle?: string; // For M3U group-title
}
