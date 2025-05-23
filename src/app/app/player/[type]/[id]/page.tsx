
"use client";

import React, { useEffect, useState }from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePlaylistStore } from '@/store/playlistStore';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { MediaItem } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlayerPage() {
  const params = useParams();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const { mediaItems, isLoading, fetchAndParsePlaylists } = usePlaylistStore();
  const [itemToPlay, setItemToPlay] = useState<MediaItem | null | undefined>(undefined); // undefined for loading, null for not found

  useEffect(() => {
    setIsClient(true);
  }, []);

  const itemId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  useEffect(() => {
    if (isClient) {
      // Ensure playlists are loaded if not already
      if (mediaItems.length === 0 && !isLoading) {
        fetchAndParsePlaylists();
      }
    }
  }, [isClient, mediaItems, isLoading, fetchAndParsePlaylists]);

  useEffect(() => {
    if (!isClient) return;

    if (mediaItems.length > 0) {
      const foundItem = mediaItems.find(item => item.id === decodeURIComponent(itemId));
      setItemToPlay(foundItem || null);
    } else if (!isLoading) {
      // If not loading and no media items, it implies it might not be found or playlists are empty
       setItemToPlay(null);
    }
  }, [isClient, itemId, mediaItems, isLoading]);

  if (!isClient || itemToPlay === undefined || (isLoading && mediaItems.length === 0 && itemToPlay === undefined)) {
    return (
      <div className="max-w-4xl mx-auto">
        <Skeleton className="h-10 w-32 mb-6" /> {/* Back button placeholder */}
        <Skeleton className="h-12 w-3/4 mb-1" /> {/* Title placeholder */}
        <Skeleton className="h-6 w-1/2 mb-4" /> {/* Group/Genre placeholder */}
        <Skeleton className="w-full aspect-video rounded-lg shadow-2xl" /> {/* Video player placeholder */}
        <div className="mt-6 p-4 border rounded-lg bg-card"> {/* Description card placeholder */}
          <Skeleton className="h-8 w-1/3 mb-2" /> {/* Description title placeholder */}
          <Skeleton className="h-5 w-full mb-1" />
          <Skeleton className="h-5 w-full mb-1" />
          <Skeleton className="h-5 w-3/4" />
        </div>
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

  return (
    <div className="max-w-4xl mx-auto">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to {itemToPlay.type}s
      </Button>
      <h1 className="text-3xl font-bold mb-2">{itemToPlay.title}</h1>
      {itemToPlay.groupTitle && <p className="text-sm text-muted-foreground mb-1">From: {itemToPlay.groupTitle}</p>}
      {itemToPlay.genre && <p className="text-sm text-muted-foreground mb-4">Genre: {itemToPlay.genre}</p>}
      
      <VideoPlayer item={itemToPlay} />
      
      {itemToPlay.description && (
        <div className="mt-6 p-4 border rounded-lg bg-card">
          <h2 className="text-xl font-semibold mb-2">Description</h2>
          <p className="text-muted-foreground">{itemToPlay.description}</p>
        </div>
      )}
    </div>
  );
}
