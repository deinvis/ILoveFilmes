
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { MediaCard } from '@/components/MediaCard';
import { AlertTriangle, Film, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';

export default function MoviesPage() {
  const [isClient, setIsClient] = useState(false);
  const { playlists, mediaItems, isLoading, error, fetchAndParsePlaylists } = usePlaylistStore();
  const [progressValue, setProgressValue] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      fetchAndParsePlaylists();
    }
  }, [fetchAndParsePlaylists, isClient]);
  
  useEffect(() => {
    if (!isClient) return;

    let interval: NodeJS.Timeout | undefined;
    if (isLoading) {
      setProgressValue(10); 
      interval = setInterval(() => {
        setProgressValue((prev) => (prev >= 90 ? 10 : prev + 15));
      }, 500);
    } else {
      if (interval) {
        clearInterval(interval);
      }
      setProgressValue(100); 
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLoading, isClient]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const allMovies = useMemo(() => mediaItems.filter(item => item.type === 'movie'), [mediaItems]);

  const filteredMovies = useMemo(() => {
    if (!debouncedSearchTerm) {
      return allMovies;
    }
    return allMovies.filter(movie => 
      movie.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (movie.groupTitle && movie.groupTitle.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
      (movie.genre && movie.genre.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
    );
  }, [allMovies, debouncedSearchTerm]);

  const groupedMovies = useMemo(() => {
    return filteredMovies.reduce((acc, movie) => {
      const group = movie.groupTitle || movie.genre || 'Uncategorized';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(movie);
      return acc;
    }, {} as Record<string, typeof filteredMovies>);
  }, [filteredMovies]);


  if (!isClient || (isLoading && allMovies.length === 0)) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-4 flex items-center"><Film className="mr-3 h-8 w-8 text-primary" /> Movies</h1>
        {isClient && isLoading && <Progress value={progressValue} className="w-full mb-8 h-2" />}
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
        <Button onClick={() => fetchAndParsePlaylists(true)}>Try Again</Button>
      </div>
    );
  }

  if (playlists.length === 0 && !isLoading) {
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
  
  if (mediaItems.length > 0 && allMovies.length === 0 && !isLoading) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center"><Film className="mr-3 h-8 w-8 text-primary" /> Movies</h1>
        {!isLoading && allMovies.length > 0 && (
           <div className="relative sm:w-1/2 md:w-1/3">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search movies..."
              className="w-full pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>
      
      {isClient && isLoading && allMovies.length > 0 && <Progress value={progressValue} className="w-full mb-4 h-2" />}
      
      {filteredMovies.length === 0 && debouncedSearchTerm && !isLoading && (
        <div className="text-center py-10">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No movies found matching your search for "{debouncedSearchTerm}".</p>
        </div>
      )}

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
      {allMovies.length > 0 && filteredMovies.length === 0 && !debouncedSearchTerm && !isLoading && (
         <div className="text-center py-10">
           <p className="text-muted-foreground">No movies to display.</p>
         </div>
       )}
    </div>
  );
}
