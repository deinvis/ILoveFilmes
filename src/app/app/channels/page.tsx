"use client";

import React, { useEffect } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { MediaCard } from '@/components/MediaCard';
import { AlertTriangle, Tv2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ChannelsPage() {
  const { mediaItems, isLoading, error, fetchAndParsePlaylists } = usePlaylistStore();

  useEffect(() => {
    fetchAndParsePlaylists();
  }, [fetchAndParsePlaylists]);
  
  const channels = mediaItems.filter(item => item.type === 'channel');

  const groupedChannels = channels.reduce((acc, channel) => {
    const group = channel.groupTitle || 'Uncategorized';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(channel);
    return acc;
  }, {} as Record<string, typeof channels>);


  if (isLoading && channels.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8 flex items-center"><Tv2 className="mr-3 h-8 w-8 text-primary" /> Channels</h1>
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
        <h2 className="text-2xl font-semibold mb-2">Error Loading Channels</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => fetchAndParsePlaylists()}>Try Again</Button>
      </div>
    );
  }
  
  if (mediaItems.length > 0 && channels.length === 0 && !isLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Tv2 className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Channels Found</h2>
        <p className="text-muted-foreground mb-4">
          It seems there are no channels in your playlists. Try adding a playlist with TV channels.
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
        <Tv2 className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Playlists Added</h2>
        <p className="text-muted-foreground mb-4">
          Please add an M3U playlist in the settings to see channels.
        </p>
        <Link href="/app/settings" passHref>
          <Button>Go to Settings</Button>
        </Link>
      </div>
    );
  }


  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-bold flex items-center"><Tv2 className="mr-3 h-8 w-8 text-primary" /> Channels</h1>
      {Object.entries(groupedChannels).map(([groupName, items]) => (
        <section key={groupName}>
          <h2 className="text-2xl font-semibold mb-6 capitalize">{groupName}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-8">
            {items.map(item => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
       {channels.length === 0 && !isLoading && (
         <div className="text-center py-10">
           <p className="text-muted-foreground">No channels found in the current playlists.</p>
         </div>
       )}
    </div>
  );
}
