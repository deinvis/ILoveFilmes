
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePlaylistStore } from '@/store/playlistStore';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { MediaItem, EpgProgram } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Film, Tv2, Clapperboard, Heart, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from '@/lib/utils';

const MEDIA_TYPE_ICONS: Record<MediaItem['type'], React.ElementType> = {
  channel: Tv2,
  movie: Film,
  series: Clapperboard,
};

export default function PlayerPage() {
  const params = useParams();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const { 
    mediaItems, 
    isLoading: storeIsLoading, 
    fetchAndParsePlaylists,
    toggleFavorite,
    isFavorite,
    epgData,
    epgLoading,
    fetchAndParseEpg,
    addRecentlyPlayed // Ensure addRecentlyPlayed is available
  } = usePlaylistStore();
  
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
      if (itemType === 'channel' && usePlaylistStore.getState().epgUrl && Object.keys(usePlaylistStore.getState().epgData).length === 0) {
        fetchAndParseEpg();
      }
    }
  }, [isClient, mediaItems, storeIsLoading, fetchAndParsePlaylists, itemType, fetchAndParseEpg]);

  useEffect(() => {
    if (!isClient) return;

    if (mediaItems.length > 0) {
      const foundItem = mediaItems.find(item => item.id === decodeURIComponent(itemId));
      setItemToPlay(foundItem || null);
      if (foundItem) {
        addRecentlyPlayed(foundItem.id); // Add to recent when item is set
      }
    } else if (!storeIsLoading) { 
       setItemToPlay(null);
    }
  }, [isClient, itemId, mediaItems, storeIsLoading, addRecentlyPlayed]);

  const getNowPlaying = (tvgId?: string): EpgProgram | null => {
    if (itemToPlay?.type !== 'channel' || !tvgId || !epgData[tvgId] || epgLoading) return null;
    const now = new Date();
    return epgData[tvgId]?.find(prog => now >= prog.start && now < prog.end) || null;
  };

  const nowPlayingProgram = useMemo(() => {
    if (itemToPlay?.type === 'channel' && itemToPlay.tvgId) {
      return getNowPlaying(itemToPlay.tvgId);
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemToPlay, epgData, epgLoading]); // getNowPlaying can be omitted if stable


  const PageIcon = itemToPlay && itemToPlay.type ? MEDIA_TYPE_ICONS[itemToPlay.type] : Film;
  const isItemFavorite = itemToPlay ? isFavorite(itemToPlay.id) : false;

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
        <h2 className="text-2xl font-semibold mb-2">Mídia Não Encontrada</h2>
        <p className="text-muted-foreground mb-6">
          O item de mídia solicitado não pôde ser encontrado em suas playlists.
        </p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <Button variant="outline" onClick={() => router.back()} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para {itemToPlay.type === 'channel' ? 'Canais' : itemToPlay.type === 'movie' ? 'Filmes' : 'Séries'}
      </Button>
      
      <Card className="overflow-hidden shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl font-bold flex items-center">
                <PageIcon className="mr-3 h-8 w-8 text-primary" />
                {itemToPlay.title}
              </CardTitle>
              
              {itemToPlay.type === 'channel' && nowPlayingProgram && (
                <CardDescription className="text-md mt-1 flex items-center text-primary">
                   <Clock className="mr-2 h-4 w-4" /> No Ar: {nowPlayingProgram.title}
                </CardDescription>
              )}

              {itemToPlay.genre && (itemToPlay.type === 'movie' || itemToPlay.type === 'series') && (
                <CardDescription className="text-md mt-1">
                  Gênero: {itemToPlay.genre}
                </CardDescription>
              )}
              {itemToPlay.groupTitle && itemToPlay.genre !== itemToPlay.groupTitle && (itemToPlay.type === 'movie' || itemToPlay.type === 'series') && (
                 <CardDescription className="text-sm text-muted-foreground mt-1">
                  (Grupo: {itemToPlay.groupTitle})
                </CardDescription>
              )}
              {itemToPlay.type === 'channel' && itemToPlay.groupTitle && (
                 <CardDescription className="text-md mt-1">
                  Grupo: {itemToPlay.groupTitle}
                </CardDescription>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleFavorite(itemToPlay.id)}
              title={isItemFavorite ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
              className="ml-4 shrink-0"
            >
              <Heart className={cn("h-6 w-6", isItemFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <VideoPlayer key={itemToPlay.id} item={itemToPlay} />
        </CardContent>
      </Card>
      
      {itemToPlay.description && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Descrição</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{itemToPlay.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
