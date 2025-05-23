
"use client";

import React, { useEffect, useState }from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePlaylistStore } from '@/store/playlistStore';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { MediaItem } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Film, Tv2, Clapperboard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// Removed imports for Alert, AlertDescription, AlertTitle as they are not used if TMDB error is removed.
// If other errors can occur that use Alert, they should be re-added or error handling refactored.

const MEDIA_TYPE_ICONS: Record<MediaItem['type'], React.ElementType> = {
  channel: Tv2,
  movie: Film,
  series: Clapperboard,
};

export default function PlayerPage() {
  const params = useParams();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const { mediaItems, isLoading: storeIsLoading, fetchAndParsePlaylists } = usePlaylistStore();
  
  const [itemToPlay, setItemToPlay] = useState<MediaItem | null | undefined>(undefined);

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
    } else if (!storeIsLoading) { 
       setItemToPlay(null);
    }
  }, [isClient, itemId, mediaItems, storeIsLoading]);

  const PageIcon = itemType ? MEDIA_TYPE_ICONS[itemType] : Film;

  if (!isClient || itemToPlay === undefined || (storeIsLoading && mediaItems.length === 0 && itemToPlay === undefined)) {
    return (
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <Skeleton className="h-10 w-36 mb-2" /> 
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" /> 
            <Skeleton className="h-5 w-1/2" /> 
          </CardHeader>
          <CardContent>
            <Skeleton className="w-full aspect-video rounded-lg" /> 
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-1/3 mb-2" /> 
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
