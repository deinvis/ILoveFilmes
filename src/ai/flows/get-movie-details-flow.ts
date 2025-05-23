
'use server';
/**
 * @fileOverview A Genkit flow to fetch enriched movie details from TMDB.
 *
 * - getMovieDetails - Fetches detailed movie information.
 * - GetMovieDetailsInput - Input type for the flow.
 * - EnrichedMovieData - Output type for the flow (defined in src/types).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { EnrichedMovieData, GetMovieDetailsInput, TmdbGenre, CastMember, CrewMember } from '@/types';

// Define Zod schemas based on types in src/types/index.ts
const GetMovieDetailsInputSchema = z.object({
  title: z.string().describe('The title of the movie to search for.'),
  year: z.string().optional().describe('The release year of the movie (YYYY), if known.'),
});

const TmdbGenreSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const CastMemberSchema = z.object({
  id: z.number(),
  name: z.string(),
  character: z.string(),
  profilePath: z.string().optional().nullable(),
});

const CrewMemberSchema = z.object({
  id: z.number(),
  name: z.string(),
  job: z.string(),
  department: z.string().optional(),
});

const EnrichedMovieDataSchema = z.object({
  title: z.string(),
  overview: z.string().optional(),
  posterPath: z.string().optional().nullable(),
  backdropPath: z.string().optional().nullable(),
  releaseDate: z.string().optional(),
  voteAverage: z.number().optional(),
  voteCount: z.number().optional(),
  runtime: z.number().optional(),
  genres: z.array(TmdbGenreSchema).optional(),
  cast: z.array(CastMemberSchema).optional(),
  crew: z.array(CrewMemberSchema).optional(),
  imdbId: z.string().optional().nullable(),
  trailerKey: z.string().optional().nullable(),
  tmdbId: z.number().optional(),
  letterboxdSearchUrl: z.string().optional(),
  imdbUrl: z.string().optional(),
});

// IMPORTANT: The user needs to set up a TMDB_API_KEY environment variable.
// You can get a free API key from https://www.themoviedb.org/settings/api
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';


export async function getMovieDetails(input: GetMovieDetailsInput): Promise<EnrichedMovieData | null> {
  return getMovieDetailsFlow(input);
}

const getMovieDetailsFlow = ai.defineFlow(
  {
    name: 'getMovieDetailsFlow',
    inputSchema: GetMovieDetailsInputSchema,
    outputSchema: EnrichedMovieDataSchema.nullable(), // Can return null if not found or error
  },
  async (input) => {
    if (!TMDB_API_KEY) {
      console.error('TMDB_API_KEY is not set. Movie details fetching will be skipped.');
      // Return a minimal response or indicate the issue
      return {
        title: input.title,
        overview: "TMDB API Key not configured. Full movie details are unavailable.",
      };
    }

    try {
      // 1. Search for the movie to get its TMDB ID
      let searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(input.title)}`;
      if (input.year) {
        searchUrl += `&primary_release_year=${input.year}`;
      }

      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) {
        console.error(`TMDB Search API error for "${input.title}": ${searchResponse.status}`);
        return null;
      }
      const searchData = await searchResponse.json();

      if (!searchData.results || searchData.results.length === 0) {
        console.warn(`No TMDB results found for "${input.title}" ${input.year || ''}`);
        return { 
            title: input.title,
            overview: "Movie details not found on TMDB.",
        };
      }

      const movieId = searchData.results[0].id; // Take the first result

      // 2. Fetch detailed movie information using the ID
      // Append 'credits' and 'videos' to get cast/crew and trailers in one go
      const detailsUrl = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos`;
      const detailsResponse = await fetch(detailsUrl);
      if (!detailsResponse.ok) {
        console.error(`TMDB Details API error for movie ID ${movieId}: ${detailsResponse.status}`);
        return null;
      }
      const movieData = await detailsResponse.json();

      // 3. Extract and map data to our EnrichedMovieData schema
      const enrichedData: EnrichedMovieData = {
        tmdbId: movieData.id,
        title: movieData.title || input.title,
        overview: movieData.overview,
        posterPath: movieData.poster_path, // Will be prefixed with TMDB_IMAGE_BASE_URL later
        backdropPath: movieData.backdrop_path,
        releaseDate: movieData.release_date,
        voteAverage: movieData.vote_average ? parseFloat(movieData.vote_average.toFixed(1)) : undefined,
        voteCount: movieData.vote_count,
        runtime: movieData.runtime,
        genres: movieData.genres as TmdbGenre[],
        imdbId: movieData.imdb_id,
        cast: movieData.credits?.cast
          ?.slice(0, 10) // Limit to top 10 cast members
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            character: c.character,
            profilePath: c.profile_path,
          } as CastMember)) || [],
        crew: movieData.credits?.crew
          ?.filter((c: any) => c.job === 'Director') // Get directors
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            job: c.job,
            department: c.department
          } as CrewMember)) || [],
        trailerKey: movieData.videos?.results?.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer')?.key,
        letterboxdSearchUrl: `https://letterboxd.com/search/films/${encodeURIComponent(movieData.title || input.title)}/`,
        imdbUrl: movieData.imdb_id ? `https://www.imdb.com/title/${movieData.imdb_id}/` : undefined,
      };
      
      return enrichedData;

    } catch (error) {
      console.error('Error in getMovieDetailsFlow:', error);
      return null;
    }
  }
);
