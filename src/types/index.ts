
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
  genre?: string; // Primarily from M3U group-title for series/movies
  groupTitle?: string; // For M3U group-title
  tvgId?: string; // tvg-id from M3U, used for EPG mapping
  // Potential future fields from M3U
  // year?: number; 
  // director?: string;
  // actors?: string[];
}

export interface EpgProgram {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  channelId: string;
}

// Types for enriched movie data from TMDB
export interface TmdbGenre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath?: string; // Relative path, e.g., /abc.jpg
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department?: string;
}

export interface EnrichedMovieData {
  title: string;
  overview?: string;
  posterPath?: string; // Relative path
  backdropPath?: string; // Relative path
  releaseDate?: string; // YYYY-MM-DD
  voteAverage?: number; // e.g. 7.5
  voteCount?: number;
  runtime?: number; // in minutes
  genres?: TmdbGenre[];
  cast?: CastMember[];
  crew?: CrewMember[]; // Especially directors
  imdbId?: string;
  trailerKey?: string; // YouTube video ID
  tmdbId?: number;
  // For direct links or constructing search links
  letterboxdSearchUrl?: string;
  imdbUrl?: string;
}

export interface GetMovieDetailsInput {
  title: string;
  year?: string; // Optional, from M3U if available
}
