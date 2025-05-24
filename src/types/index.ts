
export type MediaType = 'channel' | 'movie' | 'series';
export type StartPagePath = '/app/channels' | '/app/movies' | '/app/series' | '/app/favorites' | '/app/recent';

export type PlaylistType = 'm3u' | 'xc';

export interface PlaylistItem {
  id: string;
  type: PlaylistType;
  name?: string; 
  addedAt: string;
  
  // For M3U type
  url?: string; 
  
  // For XC type
  xcDns?: string;
  xcUsername?: string;
  xcPassword?: string;
  
  // Optional fields, mainly for XC type
  expiryDate?: string; // Store as ISO string
  // Consider adding other XC info if needed: status, max_connections etc.
}

export interface MediaItem {
  id: string; 
  type: MediaType;
  title: string;
  posterUrl?: string;
  streamUrl: string;
  description?: string;
  genre?: string;
  groupTitle?: string;
  tvgId?: string;
  originatingPlaylistId: string; 
  originatingPlaylistName?: string; 
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
