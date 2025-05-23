
import Image from 'next/image';
import Link from 'next/link';
import type { MediaItem } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, Heart, CheckCircle2 } from 'lucide-react';
import React from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface MediaCardProps {
  item: MediaItem;
  nowPlaying?: string; 
}

export function MediaCard({ item, nowPlaying }: MediaCardProps) {
  const [imageError, setImageError] = React.useState(false);
  const placeholderBaseUrl = 'https://placehold.co/300x450.png';
  const dataAiHint = item.posterUrl?.split('hint=')[1] || (item.type === 'movie' ? 'movie poster' : item.type === 'series' ? 'tv series' : 'tv broadcast');

  const posterUrl = imageError || !item.posterUrl ? placeholderBaseUrl : item.posterUrl;

  const { toggleFavorite, isFavorite, getPlaybackProgress } = usePlaylistStore();
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

  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="p-0 relative aspect-[2/3] w-full">
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

        {(item.type === 'movie' || item.type === 'series') && item.groupTitle && item.genre !== item.groupTitle && (
          <p className="text-xs text-muted-foreground/80 truncate mt-0.5" title={item.groupTitle}>
            (Group: {item.groupTitle})
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
        <Link href={`/app/player/${item.type}/${encodeURIComponent(item.id)}`} passHref legacyBehavior>
          <Button variant="default" size="sm" className="w-full">
            <PlayCircle className="mr-2 h-4 w-4" />
            {isWatched ? 'Assistir Novamente' : ((item.type === 'movie' || item.type === 'series') && playbackProgressData && progressPercentage > 0 && progressPercentage < 95 ? 'Continuar' : 'Play')}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
