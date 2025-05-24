
import Image from 'next/image';
import Link from 'next/link';
import type { MediaItem } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, Heart, CheckCircle2, ListVideo,ChevronDown } from 'lucide-react';
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
// processGroupName removed as baseName/qualityTag handles channel naming structure now
// import { processGroupName } from '@/lib/group-name-utils';


interface MediaCardProps {
  item: MediaItem; // Representative item for display (e.g., ESPN SD)
  allChannelVariants?: MediaItem[]; // All variants for this channel (e.g., ESPN SD, ESPN HD, etc.)
  nowPlaying?: string;
}

// Helper to find other MediaItem instances that represent the same logical content (for VOD)
// or variants of the same channel (for 'channel' type using baseName)
const getLogicalSourcesAndVariants = (currentItem: MediaItem, allItems: MediaItem[], parentalControlEnabled: boolean): MediaItem[] => {
  if (!currentItem) return [];
  const visibleItems = applyParentalFilter(allItems, parentalControlEnabled);

  if (currentItem.type === 'channel') {
    // For channels, find all variants based on baseName
    return visibleItems.filter(
      (item) => item.type === 'channel' && item.baseName === currentItem.baseName
    ).sort((a,b) => // Sort by quality tag, then by playlist name
        (a.qualityTag || 'ZZZ').localeCompare(b.qualityTag || 'ZZZ') || // Put items without quality tag last
        (a.originatingPlaylistName || '').localeCompare(b.originatingPlaylistName || '')
    );
  } else {
    // For VOD (movies/series), group by normalized title and type from different playlists
    // This logic is more about finding the same VOD item if it exists in multiple playlists
    // const { normalizedKey: currentItemTitleNormalizedKey } = processGroupName(currentItem.title, currentItem.type);
    // For VOD, we might not have a complex quality/source selection yet, so this part might simplify
    // For now, let's assume VOD items are unique or handled by previous multi-source logic based on title.
    // If 'allChannelVariants' is passed, it's for channels. If not, this is for VOD.
    
    // Fallback to original logic for VOD if needed, or simply return the item if no advanced VOD source selection.
    // This function's primary new role is for channel variants.
    // The old logic for VOD was:
    let potentialSources: MediaItem[];
    if (currentItem.tvgId) { // Less common for VOD
        potentialSources = visibleItems.filter(
        (item) => item.tvgId === currentItem.tvgId && item.type === currentItem.type
        );
    } else {
        // This part needs careful re-evaluation if complex VOD source selection is desired.
        // For now, if it's VOD, the "multiple sources" from different playlists is the main concern.
        const titleKey = currentItem.title.toLowerCase().replace(/\s+/g, ''); // Simple normalization
        potentialSources = visibleItems.filter(
            (item) => item.type === currentItem.type && item.title.toLowerCase().replace(/\s+/g, '') === titleKey
        );
    }
     return potentialSources.sort((a,b) => (a.originatingPlaylistName || '').localeCompare(b.originatingPlaylistName || ''));
  }
};


export function MediaCard({ item, allChannelVariants, nowPlaying }: MediaCardProps) {
  const [imageError, setImageError] = React.useState(false);
  const placeholderBaseUrl = 'https://placehold.co/300x450.png';
  // Use baseName for channels if available for data-ai-hint, otherwise title
  const hintName = item.type === 'channel' && item.baseName ? item.baseName : item.title;
  const dataAiHint = item.posterUrl?.split('hint=')[1] || (item.type === 'movie' ? 'movie poster' : item.type === 'series' ? 'tv series' : `tv broadcast ${hintName}`);

  const posterUrl = imageError || !item.posterUrl ? placeholderBaseUrl : item.posterUrl;

  const {
    toggleFavorite,
    isFavorite,
    getPlaybackProgress,
    mediaItems: allMediaItemsFromStore, // Renamed to avoid conflict
    parentalControlEnabled
  } = usePlaylistStore();

  const isItemFavorite = isFavorite(item.id); // Favorite based on the representative item

  const playbackProgressData = (item.type === 'movie' || item.type === 'series') ? getPlaybackProgress(item.id) : undefined;
  let progressPercentage = 0;
  let isWatched = false;

  if (playbackProgressData && playbackProgressData.duration > 0) {
    progressPercentage = (playbackProgressData.currentTime / playbackProgressData.duration) * 100;
    if (progressPercentage >= 95) {
      isWatched = true;
    }
  }

  const displayVariants = useMemo(() => {
    if (item.type === 'channel') {
      return allChannelVariants && allChannelVariants.length > 0 
        ? allChannelVariants 
        : getLogicalSourcesAndVariants(item, allMediaItemsFromStore, parentalControlEnabled);
    }
    // For VOD, use the existing logic to find if the same VOD item appears in multiple playlists
    return getLogicalSourcesAndVariants(item, allMediaItemsFromStore, parentalControlEnabled);
  }, [item, allChannelVariants, allMediaItemsFromStore, parentalControlEnabled]);


  const hasMultipleVariants = displayVariants.length > 1;

  const playButtonText = isWatched && (item.type === 'movie' || item.type === 'series')
    ? 'Assistir Novamente'
    : (item.type === 'movie' || item.type === 'series') && playbackProgressData && progressPercentage > 0 && progressPercentage < 95
    ? 'Continuar'
    : 'Play';
  
  const cardTitle = item.type === 'channel' ? (item.baseName || item.title) : item.title;

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
            priority={false} // Consider setting to true for above-the-fold images if applicable
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
              toggleFavorite(item.id); // Favorite the representative item
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

        {/* Display source only if NOT multiple variants for channels, or for VOD if it's truly a single source */}
        {((item.type === 'channel' && !hasMultipleVariants) || (item.type !== 'channel' && !hasMultipleVariants)) && item.originatingPlaylistName && (
           <p className="text-xs text-muted-foreground/80 truncate mt-0.5" title={`Fonte: ${item.originatingPlaylistName}`}>
            Fonte: {item.originatingPlaylistName}
          </p>
        )}


        {nowPlaying && item.type === 'channel' && (
          <p className="text-xs text-primary truncate mt-1" title={nowPlaying}>Agora: {nowPlaying}</p>
        )}

        {(item.type === 'movie' || item.type === 'series') && playbackProgressData && !isWatched && progressPercentage > 0 && (
          <Progress value={progressPercentage} className="h-1.5 w-full mt-2" />
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0">
        {hasMultipleVariants ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="w-full">
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
