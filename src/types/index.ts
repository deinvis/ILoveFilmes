
export type MediaType = 'channel' | 'movie' | 'series';
export type StartPagePath = '/app/channels' | '/app/movies' | '/app/series' | '/app/favorites' | '/app/recent';

export type PlaylistType = 'm3u' | 'xc';

export interface PlaylistItem {
  id: string;
  type: PlaylistType;
  name?: string;
  addedAt: string;
  source?: 'url' | 'file'; // To distinguish between URL-based and file-based M3U lists

  // For M3U type (if source is 'url')
  url?: string;

  // For XC type
  xcDns?: string;
  xcUsername?: string;
  xcPassword?: string;

  // Optional fields, mainly for XC type
  expiryDate?: string; // Store as ISO string
}

export interface MediaItem {
  id: string;
  type: MediaType;
  title: string; // Full original title, e.g., "ESPN HD", "GLOBO SP SD"
  posterUrl?: string;
  streamUrl: string;
  description?: string;
  genre?: string;
  groupTitle?: string; // This is the group-title from M3U
  tvgId?: string;
  originatingPlaylistId: string;
  originatingPlaylistName?: string;
  baseName?: string; // Extracted base name, e.g., "ESPN", "GLOBO SP"
  qualityTag?: string; // Extracted quality, e.g., "HD", "SD"
}

export interface EpgProgram {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  channelId: string;
}

export interface RecentlyPlayedItem {
  itemId: string;
  timestamp: number;
}

export interface PlaybackProgressData {
  currentTime: number;
  duration: number;
}

// For XC API user info response
export interface XCUserInfo {
  username?: string;
  password?: string;
  message?: string;
  auth?: number;
  status?: string;
  exp_date?: string | null; // Unix timestamp or null
  is_trial?: string;
  active_cons?: string;
  created_at?: string;
  max_connections?: string;
  allowed_output_formats?: string[];
  [key: string]: any; // For any other properties
}

export interface XCAPIResponse {
  user_info: XCUserInfo;
  server_info?: {
    [key: string]: any;
  };
}
