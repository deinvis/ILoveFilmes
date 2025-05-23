
"use client";

import React, { useEffect, useState }from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { usePlaylistStore } from '@/store/playlistStore';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { MediaItem, EnrichedMovieData, CastMember, CrewMember, TmdbGenre } from '@/types';
import { getMovieDetails } from '@/ai/flows/get-movie-details-flow';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, Film, Tv2, Clapperboard, Star, ExternalLink, Youtube, Loader2, ImageOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const MEDIA_TYPE_ICONS = {
  channel: Tv2,
  movie: Film,
  series: Clapperboard,
};

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

export default function PlayerPage() {
  const params = useParams();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const { mediaItems, isLoading: storeIsLoading, fetchAndParsePlaylists } = usePlaylistStore();
  
  const [itemToPlay, setItemToPlay] = useState<MediaItem | null | undefined>(undefined); // undefined for loading item from store, null for not found
  const [enrichedMovieData, setEnrichedMovieData] = useState<EnrichedMovieData | null>(null);
  const [isFetchingEnrichedData, setIsFetchingEnrichedData] = useState(false);
  const [enrichedDataError, setEnrichedDataError] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const itemType = (Array.isArray(params.type) ? params.type[0] : params.type) as MediaItem['type'];
  const itemId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  useEffect(() => {
    if (isClient) {
      if (mediaItems.length === 0 && !storeIsLoading) {
        fetchAndParsePlaylists();
      }
    }
  }, [isClient, mediaItems, storeIsLoading, fetchAndParsePlaylists]);

  useEffect(() => {
    if (!isClient) return;

    if (mediaItems.length > 0) {
      const foundItem = mediaItems.find(item => item.id === decodeURIComponent(itemId));
      setItemToPlay(foundItem || null);
      
      if (foundItem?.type === 'movie') {
        setIsFetchingEnrichedData(true);
        setEnrichedDataError(null);
        // Extract year from title if possible, e.g. "Movie Title (2023)"
        const yearMatch = foundItem.title.match(/\((\d{4})\)$/);
        const year = yearMatch ? yearMatch[1] : undefined;

        getMovieDetails({ title: foundItem.title.replace(/\s*\(\d{4}\)$/, '').trim(), year })
          .then(data => {
            setEnrichedMovieData(data);
            if (!data || data.overview === "Movie details not found on TMDB." || data.overview === "TMDB API Key not configured. Full movie details are unavailable.") {
                // Consider this a soft error if we got a placeholder response
                if (data && data.overview !== "Movie details not found on TMDB.") { // Only log actual config errors as errors
                    setEnrichedDataError(data.overview || "Could not fetch detailed movie information.");
                }
            }
          })
          .catch(err => {
            console.error("Error fetching enriched movie data:", err);
            setEnrichedDataError("Failed to load detailed movie information.");
          })
          .finally(() => setIsFetchingEnrichedData(false));
      } else {
        setEnrichedMovieData(null); // Clear if not a movie
      }
    } else if (!storeIsLoading) { // If mediaItems are empty and not loading, item is not found
       setItemToPlay(null);
    }
  }, [isClient, itemId, mediaItems, storeIsLoading]);

  const PageIcon = itemType ? MEDIA_TYPE_ICONS[itemType] : Film;

  // Loading state for the basic MediaItem
  if (!isClient || itemToPlay === undefined || (storeIsLoading && mediaItems.length === 0 && itemToPlay === undefined)) {
    return (
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <Skeleton className="h-10 w-36 mb-2" /> {/* Back button placeholder */}
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" /> {/* Title placeholder */}
            <Skeleton className="h-5 w-1/2" /> {/* Group/Genre placeholder */}
          </CardHeader>
          <CardContent>
            <Skeleton className="w-full aspect-video rounded-lg" /> {/* Video player placeholder */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-1/3 mb-2" /> {/* Description title placeholder */}
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!itemToPlay) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Media Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The requested media item could not be found in your playlists.
        </p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  // Movie-specific enhanced layout
  if (itemType === 'movie') {
    const movie = enrichedMovieData;
    const originalPoster = itemToPlay.posterUrl; // Poster from M3U

    return (
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <Button variant="outline" onClick={() => router.back()} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Movies
        </Button>

        {isFetchingEnrichedData && !movie && (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading movie details...</p>
          </div>
        )}

        {enrichedDataError && !isFetchingEnrichedData && (
            <Alert variant="destructive" className="my-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{enrichedDataError}</AlertDescription>
            </Alert>
        )}
        
        {/* Main movie card with player and basic info */}
        <Card className="overflow-hidden shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl font-bold flex items-center">
              <PageIcon className="mr-3 h-8 w-8 text-primary" />
              {movie?.title || itemToPlay.title}
            </CardTitle>
            {movie?.releaseDate && (
              <CardDescription className="text-md mt-1">
                Released: {new Date(movie.releaseDate).toLocaleDateString()}
                {movie?.runtime && ` | Runtime: ${movie.runtime} min`}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <VideoPlayer item={itemToPlay} />
          </CardContent>
        </Card>

        {/* Enriched Details Section - only if not fetching and data exists (even partial) */}
        {movie && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Left Column: Poster and Basic Info */}
            <div className="md:col-span-1 space-y-4">
              {movie.posterPath ? (
                <Image
                  src={`${TMDB_IMAGE_BASE_URL}w500${movie.posterPath}`}
                  alt={movie.title || itemToPlay.title}
                  width={500}
                  height={750}
                  className="rounded-lg shadow-md w-full object-cover"
                  data-ai-hint="movie poster"
                />
              ) : originalPoster ? (
                 <Image
                  src={originalPoster}
                  alt={itemToPlay.title}
                  width={500}
                  height={750}
                  className="rounded-lg shadow-md w-full object-cover"
                  data-ai-hint="movie poster generic"
                />
              ) : (
                <div className="bg-muted rounded-lg shadow-md w-full aspect-[2/3] flex items-center justify-center">
                  <ImageOff className="h-24 w-24 text-muted-foreground" />
                </div>
              )}

              {movie.voteAverage && movie.voteCount && (
                <div className="flex items-center space-x-2">
                  <Star className="h-5 w-5 text-yellow-400" />
                  <span className="font-semibold">{movie.voteAverage}/10</span>
                  <span className="text-sm text-muted-foreground">({movie.voteCount} votes)</span>
                </div>
              )}

              {movie.genres && movie.genres.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-1">Genres</h3>
                  <div className="flex flex-wrap gap-2">
                    {movie.genres.map((g) => <Badge key={g.id} variant="secondary">{g.name}</Badge>)}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                {movie.imdbUrl && (
                    <Button variant="outline" asChild className="w-full">
                        <Link href={movie.imdbUrl} target="_blank" rel="noopener noreferrer">
                            View on IMDb <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                )}
                {movie.letterboxdSearchUrl && (
                    <Button variant="outline" asChild className="w-full">
                        <Link href={movie.letterboxdSearchUrl} target="_blank" rel="noopener noreferrer">
                            Search on Letterboxd <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                )}
                 {movie.trailerKey && (
                     <Button variant="default" asChild className="w-full">
                        <Link href={`https://www.youtube.com/watch?v=${movie.trailerKey}`} target="_blank" rel="noopener noreferrer">
                           <Youtube className="mr-2 h-5 w-5" /> Watch Trailer
                        </Link>
                    </Button>
                )}
              </div>
            </div>

            {/* Right Column: Synopsis, Cast, Crew */}
            <div className="md:col-span-2 space-y-6">
              {movie.overview && (
                <Card>
                  <CardHeader><CardTitle>Synopsis</CardTitle></CardHeader>
                  <CardContent><p className="text-muted-foreground whitespace-pre-wrap">{movie.overview}</p></CardContent>
                </Card>
              )}

              {movie.cast && movie.cast.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Cast</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {movie.cast.map(actor => (
                        <div key={actor.id} className="text-center">
                          {actor.profilePath ? (
                            <Image
                              src={`${TMDB_IMAGE_BASE_URL}w185${actor.profilePath}`}
                              alt={actor.name}
                              width={185}
                              height={278}
                              className="rounded-md object-cover mx-auto mb-2"
                              data-ai-hint="actor headshot"
                            />
                          ) : (
                            <div className="bg-muted rounded-md w-[100px] h-[150px] mx-auto mb-2 flex items-center justify-center md:w-[150px] md:h-[225px]">
                                <ImageOff className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                          <p className="font-medium text-sm">{actor.name}</p>
                          <p className="text-xs text-muted-foreground">{actor.character}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {movie.crew && movie.crew.filter(c => c.job === 'Director').length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Director(s)</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {movie.crew.filter(c => c.job === 'Director').map(director => (
                        <li key={director.id}>{director.name}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
        {!movie && !isFetchingEnrichedData && itemToPlay.description && ( // Fallback to M3U description if no TMDB data
             <Card className="shadow-lg mt-6">
                <CardHeader>
                    <CardTitle className="text-2xl">Description</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{itemToPlay.description}</p>
                </CardContent>
            </Card>
        )}
      </div>
    );
  }

  // Default player page for channels and series (or movies if TMDB fetch fails gracefully)
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <Button variant="outline" onClick={() => router.back()} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to {itemToPlay.type}s
      </Button>
      
      <Card className="overflow-hidden shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center">
            <PageIcon className="mr-3 h-8 w-8 text-primary" />
            {itemToPlay.title}
          </CardTitle>
          {(itemToPlay.groupTitle || itemToPlay.genre) && (
            <CardDescription className="text-md mt-1">
              {itemToPlay.groupTitle && `From: ${itemToPlay.groupTitle}`}
              {itemToPlay.groupTitle && itemToPlay.genre && " | "}
              {itemToPlay.genre && `Genre: ${itemToPlay.genre}`}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <VideoPlayer item={itemToPlay} />
        </CardContent>
      </Card>
      
      {itemToPlay.description && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{itemToPlay.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
