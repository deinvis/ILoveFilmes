
import Image from 'next/image';
import Link from 'next/link';
import type { MediaItem } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';
import React from 'react';

interface MediaCardProps {
  item: MediaItem;
  nowPlaying?: string; // Optional: For EPG "Now Playing" info
}

export function MediaCard({ item, nowPlaying }: MediaCardProps) {
  const [imageError, setImageError] = React.useState(false);
  const placeholderBaseUrl = 'https://placehold.co/300x450.png';
  const dataAiHint = item.posterUrl?.split('hint=')[1] || (item.type === 'movie' ? 'movie poster' : item.type === 'series' ? 'tv series' : 'tv broadcast');

  const posterUrl = imageError || !item.posterUrl ? placeholderBaseUrl : item.posterUrl;

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
            priority={false} // Default to false, can be true for above-the-fold critical images
          />
        </Link>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-lg font-semibold leading-tight mb-1 truncate" title={item.title}>
          {item.title}
        </CardTitle>
        {item.groupTitle && (
          <p className="text-xs text-muted-foreground truncate">{item.groupTitle}</p>
        )}
        {nowPlaying && item.type === 'channel' && (
          <p className="text-xs text-primary truncate mt-1" title={nowPlaying}>Now: {nowPlaying}</p>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Link href={`/app/player/${item.type}/${encodeURIComponent(item.id)}`} passHref legacyBehavior>
          <Button variant="default" size="sm" className="w-full">
            <PlayCircle className="mr-2 h-4 w-4" />
            Play
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
