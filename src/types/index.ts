
export type MediaType = 'channel' | 'movie' | 'series';
export type StartPagePath = '/app/channels' | '/app/movies' | '/app/series' | '/app/favorites' | '/app/recent';

export interface PlaylistItem {
  id: string;
  url: string;
  name?: string; // Optional name for the playlist
  addedAt: string;
}

export interface MediaItem {
  id: string; // Unique ID for this specific instance of the media item from a specific playlist
  type: MediaType;
  title: string;
  posterUrl?: string;
  streamUrl: string;
  description?: string;
  genre?: string;
  groupTitle?: string;
  tvgId?: string;
  originatingPlaylistId: string; // ID of the PlaylistItem it came from
  originatingPlaylistName?: string; // Name of the PlaylistItem it came from
}

export interface EpgProgram {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  channelId: string; // Corresponds to MediaItem.tvgId
}

export interface RecentlyPlayedItem {
  itemId: string; // Corresponds to MediaItem.id
  timestamp: number;
}

export interface PlaybackProgressData {
  currentTime: number;
  duration: number;
}
