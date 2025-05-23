
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePlaylistStore } from '@/store/playlistStore';
import { MediaCard } from '@/components/MediaCard';
import type { MediaItem, MediaType } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowLeft, Tv2, Film, Clapperboard, ListFilter, Search } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';

const ITEMS_PER_PAGE = 20;

const MEDIA_TYPE_ICONS: Record<MediaType, React.ElementType> = {
  channel: Tv2,
  movie: Film,
  series: Clapperboard,
};

const MEDIA_TYPE_PATHS: Record<MediaType, string> = {
    channel: '/app/channels',
    movie: '/app/movies',
    series: '/app/series',
}

export default function GroupPage() {
  const params = useParams();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  
  const { mediaItems, isLoading: storeIsLoading, error: storeError, fetchAndParsePlaylists } = usePlaylistStore();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [progressValue, setProgressValue] = useState(10);


  const rawMediaType = Array.isArray(params.mediaType) ? params.mediaType[0] : params.mediaType;
  const rawGroupName = Array.isArray(params.groupName) ? params.groupName[0] : params.groupName;

  const mediaType = rawMediaType as MediaType;
  const groupName = useMemo(() => rawGroupName ? decodeURIComponent(rawGroupName) : 'Unknown Group', [rawGroupName]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      fetchAndParsePlaylists();
    }
  }, [fetchAndParsePlaylists, isClient]);

  useEffect(() => {
    if (!isClient) return;
    let interval: NodeJS.Timeout | undefined;
    if (storeIsLoading) {
      setProgressValue(10);
      interval = setInterval(() => {
        setProgressValue((prev) => (prev >= 90 ? 10 : prev + 15));
      }, 500);
    } else {
      if (interval) clearInterval(interval);
      setProgressValue(100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [storeIsLoading, isClient]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);


  const groupItems = useMemo(() => {
    if (!mediaType || !groupName) return [];
    return mediaItems.filter(item => {
      const itemGroup = item.groupTitle || (item.type === 'movie' || item.type === 'series' ? item.genre : undefined) || 'Uncategorized';
      return item.type === mediaType && itemGroup === groupName;
    });
  }, [mediaItems, mediaType, groupName]);

  const filteredGroupItems = useMemo(() => {
    if (!debouncedSearchTerm) return groupItems;
    return groupItems.filter(item =>
      item.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [groupItems, debouncedSearchTerm]);

  const totalPages = Math.ceil(filteredGroupItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = filteredGroupItems.slice(startIndex, endIndex);

  const PageIcon = MEDIA_TYPE_ICONS[mediaType] || ListFilter;
  const backPath = MEDIA_TYPE_PATHS[mediaType] || '/app';


  if (!isClient || (storeIsLoading && groupItems.length === 0)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-40 mb-2" /> {/* Back button */}
        <Skeleton className="h-12 w-3/4 mb-4" /> {/* Title */}
        {isClient && storeIsLoading && <Progress value={progressValue} className="w-full mb-8 h-2" />}
         <div className="relative sm:w-1/2 md:w-1/3 mb-6">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" placeholder="Search in this group..." className="w-full pl-10" disabled />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <div key={index} className="flex flex-col space-y-3">
              <Skeleton className="h-[300px] w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-64 mx-auto" /> {/* Pagination placeholder */}
      </div>
    );
  }

  if (storeError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error Loading Group</h2>
        <p className="text-muted-foreground mb-4">{storeError}</p>
        <Button onClick={() => fetchAndParsePlaylists(true)}>Try Again</Button>
        <Button variant="outline" onClick={() => router.push(backPath)} className="mt-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to {mediaType}s
        </Button>
      </div>
    );
  }

  if (!mediaType || !groupName || !['channel', 'movie', 'series'].includes(mediaType)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Invalid Group or Media Type</h2>
        <p className="text-muted-foreground mb-6">The requested group or media type is not valid.</p>
        <Button onClick={() => router.push('/app')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Main Page
        </Button>
      </div>
    );
  }

  if (groupItems.length === 0 && !storeIsLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <PageIcon className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Items in this Group</h2>
        <p className="text-muted-foreground mb-6">
          There are no {mediaType}s in the group "{groupName}".
        </p>
        <Button onClick={() => router.push(backPath)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to {mediaType}s
        </Button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
       <Button variant="outline" onClick={() => router.push(backPath)} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to all {mediaType}s
       </Button>

      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center capitalize">
          <PageIcon className="mr-3 h-8 w-8 text-primary" /> 
          {groupName} ({mediaType}s)
        </h1>
         {groupItems.length > 0 && (
            <div className="relative sm:w-1/2 md:w-1/3">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                type="search"
                placeholder={`Search in ${groupName}...`}
                className="w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        )}
      </div>

      {isClient && storeIsLoading && groupItems.length > 0 && <Progress value={progressValue} className="w-full mb-4 h-2" />}

      {filteredGroupItems.length === 0 && debouncedSearchTerm && !storeIsLoading && (
        <div className="text-center py-10">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No {mediaType}s found in "{groupName}" matching your search for "{debouncedSearchTerm}".</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-8">
        {currentItems.map(item => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-8">
          <Button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
            disabled={currentPage === 1}
            variant="outline"
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
            disabled={currentPage === totalPages}
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}
       {groupItems.length > 0 && filteredGroupItems.length === 0 && !debouncedSearchTerm && !storeIsLoading && (
         <div className="text-center py-10">
           <p className="text-muted-foreground">No {mediaType}s to display in this group with current filters.</p>
         </div>
       )}
    </div>
  );
}
