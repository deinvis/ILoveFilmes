
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { MediaCard } from '@/components/MediaCard';
import { AlertTriangle, Film, Search, ListFilter } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { applyParentalFilter } from '@/lib/parental-filter';
import type { MediaItem } from '@/types';
import { processGroupName } from '@/lib/group-name-utils';

const ITEMS_PER_GROUP_PREVIEW = 4;
type SortOrder = 'default' | 'title-asc' | 'title-desc';

export default function MoviesPage() {
  const [isClient, setIsClient] = useState(false);
  const {
    playlists,
    mediaItems,
    isLoading: storeIsLoading,
    error: storeError,
    fetchAndParsePlaylists,
    parentalControlEnabled
  } = usePlaylistStore();
  const [progressValue, setProgressValue] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const [showOnlyMultiSource, setShowOnlyMultiSource] = useState(false);

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
        setProgressValue(prev => (prev === 100 ? 10 : prev));
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
  }, [isClient, storeIsLoading]);


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const moviesParentalFiltered = useMemo(() => {
    let movies = mediaItems.filter(item => item.type === 'movie');
    return applyParentalFilter(movies, parentalControlEnabled);
  }, [mediaItems, parentalControlEnabled]);

  const vodSourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    moviesParentalFiltered.forEach(movie => {
        // Use a consistent key for grouping VOD items by title
        const { normalizedKey } = processGroupName(movie.title, 'movie'); 
        counts.set(normalizedKey, (counts.get(normalizedKey) || 0) + 1);
    });
    return counts;
  }, [moviesParentalFiltered]);

  const allMovies = useMemo(() => {
    let moviesToDisplay = [...moviesParentalFiltered];

    if (showOnlyMultiSource) {
      moviesToDisplay = moviesToDisplay.filter(movie => {
        const { normalizedKey } = processGroupName(movie.title, 'movie');
        return (vodSourceCounts.get(normalizedKey) || 0) > 1;
      });
    }

    switch (sortOrder) {
      case 'title-asc':
        moviesToDisplay = moviesToDisplay.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        moviesToDisplay = moviesToDisplay.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }
    return moviesToDisplay;
  }, [moviesParentalFiltered, sortOrder, showOnlyMultiSource, vodSourceCounts]);


  const filteredMovies = useMemo(() => {
    if (!debouncedSearchTerm) {
      return allMovies;
    }
    return allMovies.filter(movie =>
      movie.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (movie.groupTitle && movie.groupTitle.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
      (movie.genre && movie.genre.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
    );
  }, [allMovies, debouncedSearchTerm]);

  const groupedMoviesArray = useMemo(() => {
    const groupsMap: Record<string, { displayName: string; items: MediaItem[] }> = {};
    filteredMovies.forEach(movie => {
      const rawGroupName = movie.groupTitle || movie.genre || 'Uncategorized';
      const { displayName: processedDisplayName, normalizedKey } = processGroupName(rawGroupName, 'movie');
      
      if (!groupsMap[normalizedKey]) {
        groupsMap[normalizedKey] = { displayName: processedDisplayName, items: [] };
      }
      groupsMap[normalizedKey].items.push(movie);
    });

    return Object.entries(groupsMap)
      .map(([key, value]) => ({ ...value, normalizedKey: key }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [filteredMovies]);


  if (!isClient || (storeIsLoading && allMovies.length === 0 && playlists.length > 0 && !debouncedSearchTerm)) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <h1 className="text-3xl font-bold flex items-center"><Film className="mr-3 h-8 w-8 text-primary" /> Filmes</h1>
        </div>
        {isClient && storeIsLoading && <Progress value={progressValue} className="w-full my-4 h-2" />}
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

  if (storeError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <AlertTriangle className="w-20 h-20 text-destructive mb-6" />
        <h2 className="text-3xl font-semibold mb-3">Erro ao Carregar Filmes</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">{storeError}</p>
        <Button onClick={() => fetchAndParsePlaylists(true)} size="lg">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (playlists.length === 0 && !storeIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <Film className="w-24 h-24 text-primary mb-6" />
        <h2 className="text-3xl font-semibold mb-3">Nenhuma Playlist Encontrada</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          Para ver filmes, adicione uma playlist M3U ou Xtream Codes nas configurações.
        </p>
        <Link href="/app/settings" passHref>
          <Button size="lg">Ir para Configurações</Button>
        </Link>
      </div>
    );
  }

  if (mediaItems.length > 0 && allMovies.length === 0 && !storeIsLoading && !debouncedSearchTerm) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <ListFilter className="w-24 h-24 text-muted-foreground mb-6" />
        <h2 className="text-3xl font-semibold mb-3">Nenhum Filme Encontrado</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          Não há filmes para exibir com os filtros atuais. Verifique suas fontes, filtro de múltiplas fontes ou configurações de controle parental.
        </p>
        <div className="flex gap-4">
            <Link href="/app/settings" passHref>
            <Button size="lg" variant="outline">Ir para Configurações</Button>
            </Link>
            {showOnlyMultiSource && <Button size="lg" onClick={() => setShowOnlyMultiSource(false)}>Mostrar todos os filmes</Button>}
            {parentalControlEnabled && <Button size="lg" onClick={() => usePlaylistStore.getState().setParentalControlEnabled(false)}>Desativar Controle Parental</Button>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center"><Film className="mr-3 h-8 w-8 text-primary" /> Filmes</h1>
        {(playlists.length > 0 || allMovies.length > 0) && (
           <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
             <div className="relative flex-grow sm:w-64 md:w-80">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar filmes..."
                className="w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 sm:w-auto">
              <Label htmlFor="sort-movies" className="text-sm hidden sm:block">Ordenar por:</Label>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                <SelectTrigger id="sort-movies" className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão</SelectItem>
                  <SelectItem value="title-asc">Título (A-Z)</SelectItem>
                  <SelectItem value="title-desc">Título (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {(mediaItems.length > 0 || debouncedSearchTerm) && (
         <div className="flex items-center space-x-2 mt-0 mb-4">
            <Switch
                id="multi-source-filter-movies"
                checked={showOnlyMultiSource}
                onCheckedChange={setShowOnlyMultiSource}
            />
            <Label htmlFor="multi-source-filter-movies">Mostrar apenas filmes com múltiplas fontes</Label>
        </div>
      )}

      {isClient && storeIsLoading && <Progress value={progressValue} className="w-full my-4 h-2" />}

      {filteredMovies.length === 0 && debouncedSearchTerm && !storeIsLoading && (
        <div className="text-center py-16 bg-card rounded-lg shadow-md">
          <Search className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <p className="text-xl text-muted-foreground">Nenhum filme encontrado para "{debouncedSearchTerm}".</p>
          <Button variant="link" onClick={() => setSearchTerm('')} className="mt-4">Limpar Busca</Button>
        </div>
      )}

       {groupedMoviesArray.map(group => (
        <section key={group.normalizedKey}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold hover:underline">
              <Link href={`/app/group/movie/${encodeURIComponent(group.displayName)}`}>
                {group.displayName} ({group.items.length})
              </Link>
            </h2>
            {group.items.length > ITEMS_PER_GROUP_PREVIEW && (
               <Link href={`/app/group/movie/${encodeURIComponent(group.displayName)}`} passHref>
                <Button variant="link" className="text-sm">Ver Todos</Button>
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-8">
            {group.items.slice(0, ITEMS_PER_GROUP_PREVIEW).map(item => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
      {allMovies.length === 0 && !debouncedSearchTerm && !storeIsLoading && mediaItems.length > 0 && (
         <div className="text-center py-16 bg-card rounded-lg shadow-md">
           <ListFilter className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
           <p className="text-xl text-muted-foreground">Nenhum filme para exibir com os filtros atuais.</p>
            {showOnlyMultiSource && <Button variant="link" onClick={() => setShowOnlyMultiSource(false)} className="mt-4">Mostrar todos os filmes</Button>}
         </div>
       )}
    </div>
  );
}
