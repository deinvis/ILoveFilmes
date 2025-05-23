
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { MediaCard } from '@/components/MediaCard';
import { AlertTriangle, Tv2, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { MediaItem, EpgProgram } from '@/types';

const ITEMS_PER_GROUP_PREVIEW = 4; 
type SortOrder = 'default' | 'title-asc' | 'title-desc';

export default function ChannelsPage() {
  const [isClient, setIsClient] = useState(false);
  const { 
    playlists, 
    mediaItems, 
    isLoading: storeIsLoading, 
    error: storeError, 
    fetchAndParsePlaylists,
    epgData,
    epgLoading,
    fetchAndParseEpg
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
      if (usePlaylistStore.getState().epgUrl) { 
        fetchAndParseEpg();
      }
    }
  }, [fetchAndParsePlaylists, fetchAndParseEpg, isClient]);
  
  useEffect(() => {
    if (!isClient) return;

    let interval: NodeJS.Timeout | undefined;
    const combinedLoading = storeIsLoading || (epgLoading && Object.keys(epgData).length === 0);

    if (combinedLoading && mediaItems.length === 0) { 
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
  }, [storeIsLoading, epgLoading, epgData, isClient, mediaItems]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); 

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const allChannels = useMemo(() => {
    let channels = mediaItems.filter(item => item.type === 'channel');
    switch (sortOrder) {
      case 'title-asc':
        channels = [...channels].sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        channels = [...channels].sort((a, b) => b.title.localeCompare(a.title));
        break;
      // 'default' case: no sorting, use original order from mediaItems
    }
    return channels;
  }, [mediaItems, sortOrder]);

  const filteredChannels = useMemo(() => {
    if (!debouncedSearchTerm) {
      return allChannels;
    }
    return allChannels.filter(channel => 
      channel.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (channel.groupTitle && channel.groupTitle.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
    );
  }, [allChannels, debouncedSearchTerm]);

  const groupedChannels = useMemo(() => {
    return filteredChannels.reduce((acc, channel) => {
      const group = channel.groupTitle || 'Uncategorized';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(channel);
      return acc;
    }, {} as Record<string, typeof filteredChannels>);
  }, [filteredChannels]);

  const getNowPlaying = (tvgId?: string): EpgProgram | null => {
    if (!tvgId || !epgData[tvgId] || epgLoading) return null;
    const now = new Date();
    return epgData[tvgId].find(prog => now >= prog.start && now < prog.end) || null;
  };


  if (!isClient || ((storeIsLoading || (epgLoading && Object.keys(epgData).length === 0)) && allChannels.length === 0)) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <h1 className="text-3xl font-bold flex items-center"><Tv2 className="mr-3 h-8 w-8 text-primary" /> Channels</h1>
        </div>
        {isClient && (storeIsLoading || epgLoading) && <Progress value={progressValue} className="w-full mb-8 h-2" />}
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
        <h2 className="text-3xl font-semibold mb-3">Error Loading Channels</h2>
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
        <Tv2 className="w-24 h-24 text-primary mb-6" />
        <h2 className="text-3xl font-semibold mb-3">No Playlists Found</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          To get started, please add an M3U playlist in the settings. This will allow you to browse and watch channels.
        </p>
        <Link href="/app/settings" passHref>
          <Button size="lg">Go to Settings</Button>
        </Link>
      </div>
    );
  }

  if (mediaItems.length > 0 && allChannels.length === 0 && !storeIsLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <Tv2 className="w-24 h-24 text-muted-foreground mb-6" />
        <h2 className="text-3xl font-semibold mb-3">No Channels Found</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          It seems there are no TV channels in your current playlists. You might want to check your playlist sources or add one that includes channels.
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
        <h1 className="text-3xl font-bold flex items-center"><Tv2 className="mr-3 h-8 w-8 text-primary" /> Channels</h1>
        {!storeIsLoading && allChannels.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-grow sm:w-64 md:w-80">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search channels..."
                className="w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 sm:w-auto">
              <Label htmlFor="sort-channels" className="text-sm hidden sm:block">Sort by:</Label>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                <SelectTrigger id="sort-channels" className="w-full sm:w-[180px]">
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

      {isClient && (storeIsLoading || (epgLoading && Object.keys(epgData).length === 0)) && allChannels.length > 0 && mediaItems.length > 0 && <Progress value={progressValue} className="w-full mb-4 h-2" />}
      
      {filteredChannels.length === 0 && debouncedSearchTerm && !storeIsLoading && (
        <div className="text-center py-16 bg-card rounded-lg shadow-md">
          <Search className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <p className="text-xl text-muted-foreground">No channels found matching your search for "{debouncedSearchTerm}".</p>
          <Button variant="link" onClick={() => setSearchTerm('')} className="mt-4">Clear Search</Button>
        </div>
      )}

      {Object.entries(groupedChannels).map(([groupName, items]) => (
        <section key={groupName}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold capitalize hover:underline">
              <Link href={`/app/group/channel/${encodeURIComponent(groupName)}`}>
                {groupName} ({items.length})
              </Link>
            </h2>
            {items.length > ITEMS_PER_GROUP_PREVIEW && (
              <Link href={`/app/group/channel/${encodeURIComponent(groupName)}`} passHref>
                <Button variant="link" className="text-sm">View All</Button>
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-8">
            {items.slice(0, ITEMS_PER_GROUP_PREVIEW).map(item => {
              const nowPlayingProgram = getNowPlaying(item.tvgId);
              return (
                <MediaCard 
                  key={item.id} 
                  item={item} 
                  nowPlaying={nowPlayingProgram ? nowPlayingProgram.title : undefined} 
                />
              );
            })}
          </div>
        </section>
      ))}
       {allChannels.length > 0 && filteredChannels.length === 0 && !debouncedSearchTerm && !storeIsLoading && (
         <div className="text-center py-16 bg-card rounded-lg shadow-md">
           <Tv2 className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
           <p className="text-xl text-muted-foreground">No channels to display with current filters.</p>
         </div>
       )}
    </div>
  );
}
