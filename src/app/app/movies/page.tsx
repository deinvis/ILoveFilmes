
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { applyParentalFilter } from '@/lib/parental-filter';
import type { MediaItem } from '@/types';
import { processGroupName } from '@/lib/group-name-utils';

const ITEMS_PER_GROUP_PREVIEW = 4;
type SortOrder = 'default' | 'title-asc' | 'title-desc';

export default function MoviesPage() {
  const [isClient, setIsClient] = useState(false);
  const {
    playlists,
    mediaItems,
    isLoading: storeIsLoading,
    error: storeError,
    fetchAndParsePlaylists,
    parentalControlEnabled
  } = usePlaylistStore();
  const [progressValue, setProgressValue] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

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

    if (isClient && storeIsLoading) {
        setProgressValue(prev => (prev === 100 ? 10 : prev));
        interval = setInterval(() => {
        setProgressValue((prev) => (prev >= 90 ? 10 : prev + 15));
        }, 500);
    } else {
        if (interval) clearInterval(interval);
        setProgressValue(100);
    }
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [isClient, storeIsLoading]);


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const allMovies = useMemo(() => {
    let movies = mediaItems.filter(item => item.type === 'movie');
    movies = applyParentalFilter(movies, parentalControlEnabled);
    switch (sortOrder) {
      case 'title-asc':
        movies = [...movies].sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        movies = [...movies].sort((a, b) => b.title.localeCompare(a.title));
        break;
    }
    return movies;
  }, [mediaItems, sortOrder, parentalControlEnabled]);

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

  const groupedMoviesArray = useMemo(() => {
    const groupsMap: Record<string, { displayName: string; items: MediaItem[] }> = {};
    filteredMovies.forEach(movie => {
      const rawGroupName = movie.groupTitle || movie.genre || 'Uncategorized';
      const { displayName: processedDisplayName, normalizedKey } = processGroupName(rawGroupName);
      
      if (!groupsMap[normalizedKey]) {
        groupsMap[normalizedKey] = { displayName: processedDisplayName, items: [] };
      }
      groupsMap[normalizedKey].items.push(movie);
    });

    return Object.entries(groupsMap)
      .map(([key, value]) => ({ ...value, normalizedKey: key }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [filteredMovies]);


  if (!isClient || (storeIsLoading && allMovies.length === 0)) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <h1 className="text-3xl font-bold flex items-center"><Film className="mr-3 h-8 w-8 text-primary" /> Movies</h1>
        </div>
        {isClient && storeIsLoading && <Progress value={progressValue} className="w-full mb-8 h-2" />}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-4">
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

  if (storeError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <AlertTriangle className="w-20 h-20 text-destructive mb-6" />
        <h2 className="text-3xl font-semibold mb-3">Error Loading Movies</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">{storeError}</p>
        <Button onClick={() => fetchAndParsePlaylists(true)} size="lg">
          Try Again
        </Button>
      </div>
    );
  }

  if (playlists.length === 0 && !storeIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <Film className="w-24 h-24 text-primary mb-6" />
        <h2 className="text-3xl font-semibold mb-3">No Playlists Found</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          To see movies, please add an M3U playlist in the settings.
        </p>
        <Link href="/app/settings" passHref>
          <Button size="lg">Go to Settings</Button>
        </Link>
      </div>
    );
  }

  if (mediaItems.length > 0 && allMovies.length === 0 && !storeIsLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <Film className="w-24 h-24 text-muted-foreground mb-6" />
        <h2 className="text-3xl font-semibold mb-3">No Movies Found</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          It seems there are no movies in your current playlists, or they are hidden by parental controls. Try adding a playlist that includes movies or check parental control settings.
        </p>
        <Link href="/app/settings" passHref>
          <Button size="lg" variant="outline">Go to Settings</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center"><Film className="mr-3 h-8 w-8 text-primary" /> Movies</h1>
        {!storeIsLoading && allMovies.length > 0 && (
           <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
             <div className="relative flex-grow sm:w-64 md:w-80">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search movies..."
                className="w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 sm:w-auto">
              <Label htmlFor="sort-movies" className="text-sm hidden sm:block">Sort by:</Label>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                <SelectTrigger id="sort-movies" className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="title-asc">Title (A-Z)</SelectItem>
                  <SelectItem value="title-desc">Title (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {isClient && storeIsLoading && <Progress value={progressValue} className="w-full mb-4 h-2" />}

      {filteredMovies.length === 0 && debouncedSearchTerm && !storeIsLoading && (
        <div className="text-center py-16 bg-card rounded-lg shadow-md">
          <Search className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <p className="text-xl text-muted-foreground">No movies found matching your search for "{debouncedSearchTerm}".</p>
          <Button variant="link" onClick={() => setSearchTerm('')} className="mt-4">Clear Search</Button>
        </div>
      )}

       {groupedMoviesArray.map(group => (
        <section key={group.normalizedKey}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold hover:underline">
              <Link href={`/app/group/movie/${encodeURIComponent(group.displayName)}`}>
                {group.displayName} ({group.items.length})
              </Link>
            </h2>
            {group.items.length > ITEMS_PER_GROUP_PREVIEW && (
               <Link href={`/app/group/movie/${encodeURIComponent(group.displayName)}`} passHref>
                <Button variant="link" className="text-sm">View All</Button>
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-8">
            {group.items.slice(0, ITEMS_PER_GROUP_PREVIEW).map(item => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
      {allMovies.length > 0 && filteredMovies.length === 0 && !debouncedSearchTerm && !storeIsLoading && (
         <div className="text-center py-16 bg-card rounded-lg shadow-md">
           <Film className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
           <p className="text-xl text-muted-foreground">No movies to display with current filters or search term.</p>
         </div>
       )}
    </div>
  );
}
