
"use client";

import React, { useEffect, useState } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { MediaCard } from '@/components/MediaCard';
import { AlertTriangle, Film } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function MoviesPage() {
  const { mediaItems, isLoading, error, fetchAndParsePlaylists } = usePlaylistStore();
  const [progressValue, setProgressValue] = useState(10);

  useEffect(() => {
    fetchAndParsePlaylists();
  }, [fetchAndParsePlaylists]);
  
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isLoading) {
      setProgressValue(10); // Reset to initial for animation
      interval = setInterval(() => {
        setProgressValue((prev) => (prev >= 90 ? 10 : prev + 15));
      }, 500);
    } else {
      if (interval) {
        clearInterval(interval);
      }
      setProgressValue(100); // Set to 100 when not loading
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLoading]);

  const movies = mediaItems.filter(item => item.type === 'movie');

  const groupedMovies = movies.reduce((acc, movie) => {
    const group = movie.groupTitle || movie.genre || 'Uncategorized';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(movie);
    return acc;
  }, {} as Record<string, typeof movies>);

  if (isLoading && movies.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-4 flex items-center"><Film className="mr-3 h-8 w-8 text-primary" /> Movies</h1>
        <Progress value={progressValue} className="w-full mb-8 h-2" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Array.from({ length: 10 }).map((_, index) => (
             <div key={index} className="flex flex-col space-y-3">
              <Skeleton className="h-[300px] w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error Loading Movies</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => fetchAndParsePlaylists()}>Try Again</Button>
      </div>
    );
  }

  if (mediaItems.length > 0 && movies.length === 0 && !isLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Film className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Movies Found</h2>
        <p className="text-muted-foreground mb-4">
          It seems there are no movies in your playlists. Try adding a playlist with movies.
        </p>
        <Link href="/app/settings" passHref>
          <Button>Go to Settings</Button>
        </Link>
      </div>
    );
  }

  if (usePlaylistStore.getState().playlists.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Film className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Playlists Added</h2>
        <p className="text-muted-foreground mb-4">
          Please add an M3U playlist in the settings to see movies.
        </p>
        <Link href="/app/settings" passHref>
          <Button>Go to Settings</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-bold flex items-center"><Film className="mr-3 h-8 w-8 text-primary" /> Movies</h1>
       {Object.entries(groupedMovies).map(([groupName, items]) => (
        <section key={groupName}>
          <h2 className="text-2xl font-semibold mb-6 capitalize">{groupName}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-8">
            {items.map(item => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
      {movies.length === 0 && !isLoading && (
         <div className="text-center py-10">
           <p className="text-muted-foreground">No movies found in the current playlists.</p>
         </div>
       )}
    </div>
  );
}
