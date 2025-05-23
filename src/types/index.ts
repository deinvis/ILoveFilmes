
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
  tvgId?: string; // tvg-id from M3U, used for EPG mapping
}

export interface EpgProgram {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  channelId: string;
}
