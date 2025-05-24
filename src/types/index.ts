
export type MediaType = 'channel' | 'movie' | 'series';
export type StartPagePath = '/app/channels' | '/app/movies' | '/app/series' | '/app/favorites' | '/app/recent';

export type PlaylistType = 'm3u' | 'xc';

export interface PlaylistItem {
  id: string;
  type: PlaylistType;
  name?: string;
  addedAt: string;
  source?: 'url' | 'file'; // 'file' means content was from an uploaded file, not persisted itself.

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
  title: string;
  posterUrl?: string;
  streamUrl: string;
  description?: string;
  genre?: string;
  groupTitle?: string; // Raw group-title from M3U
  tvgId?: string;
  originatingPlaylistId: string;
  originatingPlaylistName?: string;
  baseName?: string;      // Extracted base name, e.g., "ESPN" from "ESPN HD"
  qualityTag?: string;    // Extracted quality, e.g., "HD" from "ESPN HD"
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
  lastUpdatedAt: number;
}

export interface XCUserInfo {
  username?: string;
  password?: string;
  message?: string;
  auth?: number;
  status?: string;
  exp_date?: string | null;
  is_trial?: string;
  active_cons?: string;
  created_at?: string;
  max_connections?: string;
  allowed_output_formats?: string[];
  [key: string]: any;
}

export interface XCAPIResponse {
  user_info: XCUserInfo;
  server_info?: {
    [key: string]: any;
  };
}

// For Zustand persist middleware
export type PersistentPlaylistState = Pick<
  PlaylistState, // Ensure PlaylistState is defined or imported if this is in a separate file from the store
  'playlists' | 
  'epgUrl' | 
  'preferredStartPage' | 
  'favoriteItemIds' | 
  'playbackProgress' | 
  'recentlyPlayed' | 
  'parentalControlEnabled' |
  'fileBasedMediaItems' |
  'manuallyWatchedItemIds' // Added for manual watched status
>;

// Forward declaration for PlaylistState if it's defined in playlistStore.ts
// This helps avoid circular dependencies if types are split.
// If PlaylistState is defined in this file, this is not strictly necessary.
export interface PlaylistState {
  playlists: PlaylistItem[];
  mediaItems: MediaItem[];
  fileBasedMediaItems: MediaItem[];
  addPlaylist: (playlistData: {
    type: PlaylistType;
    url?: string;
    xcDns?: string;
    xcUsername?: string;
    xcPassword?: string;
    name?: string;
  }) => Promise<void>;
  addPlaylistFromFileContent: (fileContent: string, fileName: string) => Promise<void>;
  removePlaylist: (id: string) => void;
  updatePlaylist: (playlistId: string, updates: Partial<PlaylistItem>) => Promise<void>;
  fetchAndParsePlaylists: (forceRefresh?: boolean) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  epgUrl: string | null;
  epgData: Record<string, EpgProgram[]>;
  epgLoading: boolean;
  epgError: string | null;
  setEpgUrl: (url: string | null) => Promise<void>;
  fetchAndParseEpg: (forceRefresh?: boolean) => Promise<void>;
  preferredStartPage: StartPagePath;
  setPreferredStartPage: (path: StartPagePath) => void;
  favoriteItemIds: string[];
  toggleFavorite: (itemId: string) => void;
  isFavorite: (itemId: string) => boolean;
  playbackProgress: Record<string, PlaybackProgressData>;
  updatePlaybackProgress: (itemId: string, currentTime: number, duration: number) => void;
  getPlaybackProgress: (itemId: string) => PlaybackProgressData | undefined;
  recentlyPlayed: RecentlyPlayedItem[];
  addRecentlyPlayed: (itemId: string) => void;
  parentalControlEnabled: boolean;
  setParentalControlEnabled: (enabled: boolean) => void;
  manuallyWatchedItemIds: string[]; // Added
  toggleManuallyWatched: (itemId: string) => void; // Added
  resetAppState: () => void;
}
