
import Image from 'next/image';
import Link from 'next/link';
import type { MediaItem } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, Heart, CheckCircle2, ListVideo } from 'lucide-react';
import React, { useMemo } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MediaCardProps {
  item: MediaItem;
  nowPlaying?: string; 
}

// Helper to find other MediaItem instances that represent the same logical content
const getLogicalSources = (currentItem: MediaItem, allItems: MediaItem[]): MediaItem[] => {
  if (!currentItem) return [];
  
  // If tvgId exists, it's the primary way to identify the same channel/VOD across playlists
  if (currentItem.tvgId) {
    return allItems.filter(
      (item) => item.tvgId === currentItem.tvgId && item.type === currentItem.type
    );
  }
  // Fallback for VOD or items without tvgId: match by normalized title and type
  // This is less reliable due to title variations but better than nothing.
  const normalizedCurrentTitle = currentItem.title.toLowerCase().trim();
  return allItems.filter(
    (item) =>
      item.title.toLowerCase().trim() === normalizedCurrentTitle &&
      item.type === currentItem.type
  );
};


export function MediaCard({ item, nowPlaying }: MediaCardProps) {
  const [imageError, setImageError] = React.useState(false);
  const placeholderBaseUrl = 'https://placehold.co/300x450.png';
  const dataAiHint = item.posterUrl?.split('hint=')[1] || (item.type === 'movie' ? 'movie poster' : item.type === 'series' ? 'tv series' : 'tv broadcast');

  const posterUrl = imageError || !item.posterUrl ? placeholderBaseUrl : item.posterUrl;

  const { 
    toggleFavorite, 
    isFavorite, 
    getPlaybackProgress,
    mediaItems: allMediaItems // Get all media items from the store
  } = usePlaylistStore();

  const isItemFavorite = isFavorite(item.id);

  const playbackProgressData = (item.type === 'movie' || item.type === 'series') ? getPlaybackProgress(item.id) : undefined;
  let progressPercentage = 0;
  let isWatched = false;

  if (playbackProgressData && playbackProgressData.duration > 0) {
    progressPercentage = (playbackProgressData.currentTime / playbackProgressData.duration) * 100;
    if (progressPercentage >= 95) {
      isWatched = true;
    }
  }

  const logicalSources = useMemo(() => getLogicalSources(item, allMediaItems), [item, allMediaItems]);
  const hasMultipleSources = logicalSources.length > 1;

  const playButtonText = isWatched 
    ? 'Assistir Novamente' 
    : (item.type === 'movie' || item.type === 'series') && playbackProgressData && progressPercentage > 0 && progressPercentage < 95 
    ? 'Continuar' 
    : 'Play';

  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="p-0 relative aspect-[2/3] w-full">
        {/* Link to player (default to first source if multiple, but selector overrides) */}
        <Link href={`/app/player/${item.type}/${encodeURIComponent(item.id)}`} className="block w-full h-full">
          <Image
            src={posterUrl}
            alt={item.title}
            width={300}
            height={450}
            className="object-cover w-full h-full"
            onError={() => setImageError(true)}
            data-ai-hint={dataAiHint}
            priority={false} 
          />
        </Link>
        {isWatched && (item.type === 'movie' || item.type === 'series') && (
          <div
            className="absolute top-2 left-2 bg-black/60 text-white p-1.5 rounded-full flex items-center justify-center"
            title="Assistido"
          >
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          </div>
        )}
        <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white hover:text-red-400 rounded-full"
            onClick={(e) => {
              e.preventDefault(); 
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
            title={isItemFavorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Heart className={cn("h-5 w-5", isItemFavorite ? "fill-red-500 text-red-500" : "text-white")} />
          </Button>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-lg font-semibold leading-tight mb-1 truncate" title={item.title}>
          {item.title}
        </CardTitle>
        
        {(item.type === 'movie' || item.type === 'series') && item.genre && (
          <p className="text-xs text-muted-foreground truncate" title={item.genre}>
            {item.genre}
          </p>
        )}

        {item.originatingPlaylistName && (
           <p className="text-xs text-muted-foreground/80 truncate mt-0.5" title={`From: ${item.originatingPlaylistName}`}>
            Fonte: {item.originatingPlaylistName}
          </p>
        )}
        
        {item.type === 'channel' && item.groupTitle && (
           <p className="text-xs text-muted-foreground truncate" title={item.groupTitle}>{item.groupTitle}</p>
        )}

        {nowPlaying && item.type === 'channel' && (
          <p className="text-xs text-primary truncate mt-1" title={nowPlaying}>Now: {nowPlaying}</p>
        )}
        
        {(item.type === 'movie' || item.type === 'series') && playbackProgressData && !isWatched && progressPercentage > 0 && (
          <Progress value={progressPercentage} className="h-1.5 w-full mt-2" />
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0">
        {hasMultipleSources ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="w-full">
                <ListVideo className="mr-2 h-4 w-4" />
                Play / Selecionar Fonte ({logicalSources.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[--radix-dropdown-menu-trigger-width]">
              {logicalSources.map((source, index) => (
                <DropdownMenuItem key={source.id} asChild>
                  <Link href={`/app/player/${source.type}/${encodeURIComponent(source.id)}`} className="w-full">
                    {source.originatingPlaylistName || `Fonte ${index + 1}`}
                    {source.id === item.id && <span className="ml-auto text-xs text-muted-foreground">(Atual)</span>}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href={`/app/player/${item.type}/${encodeURIComponent(item.id)}`} passHref legacyBehavior>
            <Button variant="default" size="sm" className="w-full">
              <PlayCircle className="mr-2 h-4 w-4" />
              {playButtonText}
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
