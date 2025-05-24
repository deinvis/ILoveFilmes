
import Image from 'next/image';
import Link from 'next/link';
import type { MediaItem } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, Heart, CheckCircle2, ListVideo, ChevronDown } from 'lucide-react';
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
import { applyParentalFilter } from '@/lib/parental-filter';


interface MediaCardProps {
  item: MediaItem; 
  allChannelVariants?: MediaItem[]; 
  nowPlaying?: string;
}

const getLogicalSourcesAndVariants = (currentItem: MediaItem, allItems: MediaItem[], parentalControlEnabled: boolean): MediaItem[] => {
  if (!currentItem) return [];
  const visibleItems = applyParentalFilter(allItems, parentalControlEnabled);

  if (currentItem.type === 'channel') {
    // For channels, allChannelVariants is passed directly if available (pre-computed)
    // Otherwise, find all variants based on baseName (should ideally be pre-computed and passed)
    if (currentItem.baseName) {
        return visibleItems.filter(
            (item) => item.type === 'channel' && item.baseName === currentItem.baseName
        ).sort((a,b) => 
            (a.qualityTag || 'ZZZ').localeCompare(b.qualityTag || 'ZZZ') || 
            (a.originatingPlaylistName || '').localeCompare(b.originatingPlaylistName || '')
        );
    }
    // Fallback if baseName somehow not present (shouldn't happen with current parser)
    return [currentItem]; 
  } else { // For VOD (movies/series)
    let potentialSources: MediaItem[];
     // Normalize title for VOD grouping: lowercase and remove all spaces
    const titleKey = currentItem.title.toLowerCase().replace(/\s+/g, '');
    potentialSources = visibleItems.filter(
        (item) => item.type === currentItem.type && item.title.toLowerCase().replace(/\s+/g, '') === titleKey
    );
    return potentialSources.sort((a,b) => (a.originatingPlaylistName || '').localeCompare(b.originatingPlaylistName || ''));
  }
};


export function MediaCard({ item, allChannelVariants, nowPlaying }: MediaCardProps) {
  const [imageError, setImageError] = React.useState(false);
  const placeholderBaseUrl = 'https://placehold.co/300x450.png';
  const hintName = item.type === 'channel' && item.baseName ? item.baseName : item.title;
  const dataAiHint = item.posterUrl?.split('hint=')[1] || (item.type === 'movie' ? 'movie poster' : item.type === 'series' ? 'tv series' : `tv broadcast ${hintName}`);

  const posterUrl = imageError || !item.posterUrl ? placeholderBaseUrl : item.posterUrl;

  const {
    toggleFavorite,
    isFavorite,
    getPlaybackProgress,
    mediaItems: allMediaItemsFromStore, 
    parentalControlEnabled,
    manuallyWatchedItemIds,
    toggleManuallyWatched,
  } = usePlaylistStore();

  const isItemFavorite = isFavorite(item.id); 

  const playbackProgressData = (item.type === 'movie' || item.type === 'series') ? getPlaybackProgress(item.id) : undefined;
  let progressPercentage = 0;
  
  const isProgressWatched = !!(playbackProgressData && playbackProgressData.duration > 0 && (playbackProgressData.currentTime / playbackProgressData.duration) * 100 >= 95);
  const isManuallyMarkedAsWatched = manuallyWatchedItemIds.includes(item.id);
  const finalIsWatched = isManuallyMarkedAsWatched || isProgressWatched;

  if (playbackProgressData && playbackProgressData.duration > 0) {
    progressPercentage = (playbackProgressData.currentTime / playbackProgressData.duration) * 100;
  }

  // Use `allChannelVariants` if provided (for channels from ChannelsPage/GroupPage),
  // otherwise compute logical sources for VOD items or as a fallback.
  const displayVariants = useMemo(() => {
    if (item.type === 'channel' && allChannelVariants && allChannelVariants.length > 0) {
      return allChannelVariants;
    }
    return getLogicalSourcesAndVariants(item, allMediaItemsFromStore, parentalControlEnabled);
  }, [item, allChannelVariants, allMediaItemsFromStore, parentalControlEnabled]);

  const hasMultipleVariants = displayVariants.length > 1;
  const cardTitle = item.type === 'channel' ? (item.baseName || item.title) : item.title;

  const playButtonText = finalIsWatched && (item.type === 'movie' || item.type === 'series')
    ? 'Assistir Novamente'
    : (item.type === 'movie' || item.type === 'series') && playbackProgressData && !isManuallyMarkedAsWatched && progressPercentage > 0 && progressPercentage < 95
    ? 'Continuar'
    : 'Play';
  
  const showProgressBar = (item.type === 'movie' || item.type === 'series') && 
                          playbackProgressData && 
                          !finalIsWatched && // Hide if finally watched (manual or progress)
                          progressPercentage > 0;


  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="p-0 relative aspect-[2/3] w-full">
        <Link href={`/app/player/${item.type}/${encodeURIComponent(item.id)}`} className="block w-full h-full">
          <Image
            src={posterUrl}
            alt={cardTitle}
            width={300}
            height={450}
            className="object-cover w-full h-full"
            onError={() => setImageError(true)}
            data-ai-hint={dataAiHint}
            priority={false} 
          />
        </Link>
        {finalIsWatched && (item.type === 'movie' || item.type === 'series') && (
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
            title={isItemFavorite ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
          >
            <Heart className={cn("h-5 w-5", isItemFavorite ? "fill-red-500 text-red-500" : "text-white")} />
          </Button>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-lg font-semibold leading-tight mb-1 truncate" title={cardTitle}>
          {cardTitle}
        </CardTitle>

        {item.type === 'channel' && item.groupTitle && (
           <p className="text-xs text-muted-foreground truncate" title={item.groupTitle}>{item.groupTitle}</p>
        )}
        {(item.type === 'movie' || item.type === 'series') && item.genre && (
          <p className="text-xs text-muted-foreground truncate" title={item.genre}>
            {item.genre}
          </p>
        )}
        
        {/* Display source only if NOT multiple variants OR if it's VOD without multiple sources */}
        {((item.type === 'channel' && !hasMultipleVariants && allChannelVariants && allChannelVariants.length <=1 ) || (item.type !== 'channel' && !hasMultipleVariants)) && item.originatingPlaylistName && (
           <p className="text-xs text-muted-foreground/80 truncate mt-0.5" title={`Fonte: ${item.originatingPlaylistName}`}>
            Fonte: {item.originatingPlaylistName}
          </p>
        )}

        {nowPlaying && item.type === 'channel' && (
          <p className="text-xs text-primary truncate mt-1" title={nowPlaying}>Agora: {nowPlaying}</p>
        )}

        {showProgressBar && (
          <Progress value={progressPercentage} className="h-1.5 w-full mt-2" />
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex gap-2">
        {hasMultipleVariants ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="flex-grow">
                <ListVideo className="mr-1 h-4 w-4" />
                 {item.type === 'channel' ? 'Qualidade/Fonte' : 'Selecionar Fonte'} ({displayVariants.length})
                <ChevronDown className="ml-auto h-4 w-4"/>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[--radix-dropdown-menu-trigger-width]">
              {displayVariants.map((variant) => (
                <DropdownMenuItem key={variant.id} asChild>
                  <Link href={`/app/player/${variant.type}/${encodeURIComponent(variant.id)}`} className="w-full">
                    {item.type === 'channel' ? 
                      `${variant.qualityTag || 'Original'} (${variant.originatingPlaylistName || 'Fonte Desconhecida'})` :
                      `${variant.originatingPlaylistName || `Fonte ${variant.id.slice(-4)}`}`
                    }
                    {variant.id === item.id && <span className="ml-auto text-xs text-muted-foreground">(Atual)</span>}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href={`/app/player/${item.type}/${encodeURIComponent(item.id)}`} passHref legacyBehavior>
            <Button variant="default" size="sm" className="flex-grow">
              <PlayCircle className="mr-2 h-4 w-4" />
              {playButtonText}
            </Button>
          </Link>
        )}
        {(item.type === 'movie' || item.type === 'series') && (
           <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleManuallyWatched(item.id);
            }}
            title={isManuallyMarkedAsWatched ? "Marcar como não assistido" : "Marcar como assistido"}
           >
            <CheckCircle2 className={cn("h-5 w-5", isManuallyMarkedAsWatched ? "fill-primary text-primary-foreground" : "text-muted-foreground" )} />
           </Button>
        )}
      </CardFooter>
    </Card>
  );
}
