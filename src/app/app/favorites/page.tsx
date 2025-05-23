
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { MediaCard } from '@/components/MediaCard';
import { AlertTriangle, Heart, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import type { MediaItem, EpgProgram } from '@/types'; // Added EpgProgram

export default function FavoritesPage() {
  const [isClient, setIsClient] = useState(false);
  const { 
    mediaItems, 
    isLoading: storeIsLoading, 
    error: storeError, 
    fetchAndParsePlaylists,
    favoriteItemIds,
    epgData, // For EPG now playing info
    epgLoading, // For EPG now playing info
    fetchAndParseEpg // For EPG now playing info
  } = usePlaylistStore();
  
  const [progressValue, setProgressValue] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient) {
      fetchAndParsePlaylists();
      if (usePlaylistStore.getState().epgUrl) { 
        fetchAndParseEpg();
      }
    }
  }, [fetchAndParsePlaylists, fetchAndParseEpg, isClient]);
  
  useEffect(() => {
    if (!isClient) return;

    let interval: NodeJS.Timeout | undefined;
    // Consider both media items loading and EPG loading if EPG is used.
    const combinedLoading = storeIsLoading || (epgLoading && Object.keys(epgData).length === 0);

    if (combinedLoading && mediaItems.length === 0 && favoriteItemIds.length > 0) { 
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
  }, [storeIsLoading, epgLoading, epgData, isClient, mediaItems, favoriteItemIds]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); 

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const favoriteMediaItems = useMemo(() => {
    return mediaItems.filter(item => favoriteItemIds.includes(item.id));
  }, [mediaItems, favoriteItemIds]);

  const filteredFavoriteItems = useMemo(() => {
    if (!debouncedSearchTerm) {
      return favoriteMediaItems;
    }
    return favoriteMediaItems.filter(item => 
      item.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (item.groupTitle && item.groupTitle.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
    );
  }, [favoriteMediaItems, debouncedSearchTerm]);

  const getNowPlaying = (tvgId?: string): EpgProgram | null => {
    if (!tvgId || !epgData[tvgId] || epgLoading) return null;
    const now = new Date();
    return epgData[tvgId].find(prog => now >= prog.start && now < prog.end) || null;
  };

  if (!isClient || ((storeIsLoading || (epgLoading && Object.keys(epgData).length === 0)) && favoriteMediaItems.length === 0 && favoriteItemIds.length > 0)) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center"><Heart className="mr-3 h-8 w-8 text-primary fill-primary" /> My Favorites</h1>
        {isClient && (storeIsLoading || epgLoading) && <Progress value={progressValue} className="w-full mb-8 h-2" />}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-4">
          {Array.from({ length: favoriteItemIds.length > 0 ? Math.min(favoriteItemIds.length, 10) : 5 }).map((_, index) => (
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
        <h2 className="text-3xl font-semibold mb-3">Error Loading Favorites</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">{storeError}</p>
        <Button onClick={() => fetchAndParsePlaylists(true)} size="lg">
          Try Again
        </Button>
      </div>
    );
  }
  
  if (favoriteItemIds.length === 0 && !storeIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <Heart className="w-24 h-24 text-muted-foreground mb-6" />
        <h2 className="text-3xl font-semibold mb-3">No Favorites Yet</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          You haven't added any items to your favorites. Click the heart icon on any channel, movie, or series to add it here!
        </p>
      </div>
    );
  }
  
  if (mediaItems.length > 0 && favoriteMediaItems.length === 0 && favoriteItemIds.length > 0 && !storeIsLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <Heart className="w-24 h-24 text-muted-foreground mb-6" />
        <h2 className="text-3xl font-semibold mb-3">Favorites Not Found</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          Some of your favorited items could not be found in the current playlists. They might have been removed from the source.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center"><Heart className="mr-3 h-8 w-8 text-primary fill-primary" /> My Favorites ({filteredFavoriteItems.length})</h1>
        {!storeIsLoading && favoriteMediaItems.length > 0 && (
          <div className="relative sm:w-1/2 md:w-1/3">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search in favorites..."
              className="w-full pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      {isClient && (storeIsLoading || (epgLoading && Object.keys(epgData).length === 0)) && favoriteMediaItems.length > 0 && <Progress value={progressValue} className="w-full mb-4 h-2" />}
      
      {filteredFavoriteItems.length === 0 && debouncedSearchTerm && !storeIsLoading && (
        <div className="text-center py-16 bg-card rounded-lg shadow-md">
          <Search className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <p className="text-xl text-muted-foreground">No favorites found matching your search for "{debouncedSearchTerm}".</p>
          <Button variant="link" onClick={() => setSearchTerm('')} className="mt-4">Clear Search</Button>
        </div>
      )}

      {filteredFavoriteItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-8">
            {filteredFavoriteItems.map(item => {
              const nowPlayingProgram = item.type === 'channel' ? getNowPlaying(item.tvgId) : null;
              return (
                <MediaCard 
                  key={item.id} 
                  item={item} 
                  nowPlaying={nowPlayingProgram ? nowPlayingProgram.title : undefined} 
                />
              );
            })}
        </div>
      )}
    </div>
  );
}
