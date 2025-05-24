
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { MediaCard } from '@/components/MediaCard';
import { AlertTriangle, Clapperboard, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { applyParentalFilter } from '@/lib/parental-filter';

const ITEMS_PER_GROUP_PREVIEW = 4; 
type SortOrder = 'default' | 'title-asc' | 'title-desc';

export default function SeriesPage() {
  const [isClient, setIsClient] = useState(false);
  const { 
    playlists, 
    mediaItems, 
    isLoading, 
    error, 
    fetchAndParsePlaylists,
    parentalControlEnabled 
  } = usePlaylistStore();
  const [progressValue, setProgressValue] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      fetchAndParsePlaylists();
    }
  }, [fetchAndParsePlaylists, isClient]);
  
  useEffect(() => {
    if(!isClient) return;

    let interval: NodeJS.Timeout | undefined;
    if (isLoading && mediaItems.length === 0) { 
      setProgressValue(10); 
      interval = setInterval(() => {
        setProgressValue((prev) => (prev >= 90 ? 10 : prev + 15));
      }, 500);
    } else {
      if (interval) {
        clearInterval(interval);
      }
      setProgressValue(100); 
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLoading, isClient, mediaItems]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); 

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const allSeries = useMemo(() => {
    let series = mediaItems.filter(item => item.type === 'series');
    series = applyParentalFilter(series, parentalControlEnabled);
    switch (sortOrder) {
      case 'title-asc':
        series = [...series].sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        series = [...series].sort((a, b) => b.title.localeCompare(a.title));
        break;
    }
    return series;
  }, [mediaItems, sortOrder, parentalControlEnabled]);

  const filteredSeries = useMemo(() => {
    if (!debouncedSearchTerm) {
      return allSeries;
    }
    return allSeries.filter(s => 
      s.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (s.groupTitle && s.groupTitle.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
      (s.genre && s.genre.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
    );
  }, [allSeries, debouncedSearchTerm]);
  
  const groupedSeries = useMemo(() => {
    return filteredSeries.reduce((acc, s) => {
      const group = s.groupTitle || s.genre || 'Uncategorized';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(s);
      return acc;
    }, {} as Record<string, typeof filteredSeries>);
  }, [filteredSeries]);


  if (!isClient || (isLoading && allSeries.length === 0)) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <h1 className="text-3xl font-bold flex items-center"><Clapperboard className="mr-3 h-8 w-8 text-primary" /> Series</h1>
        </div>
        {isClient && isLoading && <Progress value={progressValue} className="w-full mb-8 h-2" />}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-4">
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
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <AlertTriangle className="w-20 h-20 text-destructive mb-6" />
        <h2 className="text-3xl font-semibold mb-3">Error Loading Series</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">{error}</p>
        <Button onClick={() => fetchAndParsePlaylists(true)} size="lg">
          Try Again
        </Button>
      </div>
    );
  }

  if (playlists.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <Clapperboard className="w-24 h-24 text-primary mb-6" />
        <h2 className="text-3xl font-semibold mb-3">No Playlists Found</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          To see series, please add an M3U playlist in the settings.
        </p>
        <Link href="/app/settings" passHref>
          <Button size="lg">Go to Settings</Button>
        </Link>
      </div>
    );
  }
  
  if (mediaItems.length > 0 && allSeries.length === 0 && !isLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <Clapperboard className="w-24 h-24 text-muted-foreground mb-6" />
        <h2 className="text-3xl font-semibold mb-3">No Series Found</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          It seems there are no series in your current playlists, or they are hidden by parental controls. Try adding a playlist that includes TV series or check parental control settings.
        </p>
        <Link href="/app/settings" passHref>
          <Button size="lg" variant="outline">Go to Settings</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center"><Clapperboard className="mr-3 h-8 w-8 text-primary" /> Series</h1>
        {!isLoading && allSeries.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-grow sm:w-64 md:w-80">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search series..."
                className="w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 sm:w-auto">
              <Label htmlFor="sort-series" className="text-sm hidden sm:block">Sort by:</Label>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                <SelectTrigger id="sort-series" className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="title-asc">Title (A-Z)</SelectItem>
                  <SelectItem value="title-desc">Title (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {isClient && isLoading && allSeries.length > 0 && mediaItems.length > 0 && <Progress value={progressValue} className="w-full mb-4 h-2" />}

      {filteredSeries.length === 0 && debouncedSearchTerm && !isLoading && (
        <div className="text-center py-16 bg-card rounded-lg shadow-md">
          <Search className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <p className="text-xl text-muted-foreground">No series found matching your search for "{debouncedSearchTerm}".</p>
           <Button variant="link" onClick={() => setSearchTerm('')} className="mt-4">Clear Search</Button>
        </div>
      )}

      {Object.entries(groupedSeries).map(([groupName, items]) => (
        <section key={groupName}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold capitalize hover:underline">
              <Link href={`/app/group/series/${encodeURIComponent(groupName)}`}>
                {groupName} ({items.length})
              </Link>
            </h2>
            {items.length > ITEMS_PER_GROUP_PREVIEW && (
              <Link href={`/app/group/series/${encodeURIComponent(groupName)}`} passHref>
                <Button variant="link" className="text-sm">View All</Button>
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-8">
            {items.slice(0, ITEMS_PER_GROUP_PREVIEW).map(item => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
      {allSeries.length > 0 && filteredSeries.length === 0 && !debouncedSearchTerm && !isLoading && (
         <div className="text-center py-16 bg-card rounded-lg shadow-md">
           <Clapperboard className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
           <p className="text-xl text-muted-foreground">No series to display with current filters or search term.</p>
         </div>
       )}
    </div>
  );
}

