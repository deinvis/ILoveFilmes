
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { MediaCard } from '@/components/MediaCard';
import { AlertTriangle, Heart, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import type { MediaItem, EpgProgram } from '@/types';
import { applyParentalFilter } from '@/lib/parental-filter';

const ITEMS_PER_PAGE = 20;

export default function FavoritesPage() {
  const [isClient, setIsClient] = useState(false);
  const { 
    mediaItems, 
    isLoading: storeIsLoading, 
    error: storeError, 
    fetchAndParsePlaylists,
    favoriteItemIds,
    epgData, 
    epgLoading, 
    fetchAndParseEpg,
    parentalControlEnabled
  } = usePlaylistStore();
  
  const [progressValue, setProgressValue] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient) {
      fetchAndParsePlaylists();
      if (usePlaylistStore.getState().epgUrl) { 
        fetchAndParseEpg();
      }
    }
  }, [fetchAndParsePlaylists, fetchAndParseEpg, isClient]);
  
  useEffect(() => {
    if (!isClient) return;

    let interval: NodeJS.Timeout | undefined;
    const combinedLoading = storeIsLoading || (epgLoading && Object.keys(epgData).length === 0 && mediaItems.filter(item => favoriteItemIds.includes(item.id)).length > 0);

    if (combinedLoading && favoriteMediaItems.length === 0 && favoriteItemIds.length > 0) { 
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
  }, [isClient, storeIsLoading, epgLoading, epgData, favoriteItemIds, mediaItems]); // Added mediaItems to re-evaluate when they load

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page on new search
    }, 300); 

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const favoriteMediaItems = useMemo(() => {
    let items = mediaItems.filter(item => favoriteItemIds.includes(item.id));
    items = applyParentalFilter(items, parentalControlEnabled);
    return items;
  }, [mediaItems, favoriteItemIds, parentalControlEnabled]);

  const filteredFavoriteItems = useMemo(() => {
    if (!debouncedSearchTerm) {
      return favoriteMediaItems;
    }
    return favoriteMediaItems.filter(item => 
      item.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (item.groupTitle && item.groupTitle.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
    );
  }, [favoriteMediaItems, debouncedSearchTerm]);

  const totalPages = Math.ceil(filteredFavoriteItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItemsToDisplay = filteredFavoriteItems.slice(startIndex, endIndex);

  const getNowPlaying = (tvgId?: string): EpgProgram | null => {
    if (!tvgId || !epgData[tvgId] || epgLoading) return null;
    const now = new Date();
    return epgData[tvgId].find(prog => now >= prog.start && now < prog.end) || null;
  };

  if (!isClient || ((storeIsLoading || (epgLoading && Object.keys(epgData).length === 0)) && favoriteMediaItems.length === 0 && favoriteItemIds.length > 0)) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center"><Heart className="mr-3 h-8 w-8 text-primary fill-primary" /> Meus Favoritos</h1>
        {isClient && (storeIsLoading || (epgLoading && Object.keys(epgData).length === 0 && mediaItems.filter(item => favoriteItemIds.includes(item.id)).length > 0)) && <Progress value={progressValue} className="w-full my-4 h-2" />}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-4">
          {Array.from({ length: favoriteItemIds.length > 0 ? Math.min(favoriteItemIds.length, ITEMS_PER_PAGE) : 5 }).map((_, index) => (
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
        <h2 className="text-3xl font-semibold mb-3">Erro ao Carregar Favoritos</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">{storeError}</p>
        <Button onClick={() => fetchAndParsePlaylists(true)} size="lg">
          Tentar Novamente
        </Button>
      </div>
    );
  }
  
  if (favoriteItemIds.length === 0 && !storeIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <Heart className="w-24 h-24 text-muted-foreground mb-6" />
        <h2 className="text-3xl font-semibold mb-3">Nenhum Favorito Ainda</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          Você não adicionou nenhum item aos seus favoritos. Clique no ícone de coração em qualquer canal, filme ou série para adicioná-lo aqui!
        </p>
      </div>
    );
  }
  
  if (mediaItems.length > 0 && favoriteMediaItems.length === 0 && favoriteItemIds.length > 0 && !storeIsLoading && !debouncedSearchTerm) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <Heart className="w-24 h-24 text-muted-foreground mb-6" />
        <h2 className="text-3xl font-semibold mb-3">Favoritos Não Encontrados</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          Alguns dos seus itens favoritados não puderam ser encontrados nas playlists atuais ou estão ocultos pelo controle parental. Eles podem ter sido removidos da fonte ou verifique as configurações do controle parental.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center"><Heart className="mr-3 h-8 w-8 text-primary fill-primary" /> Meus Favoritos ({filteredFavoriteItems.length})</h1>
        {!storeIsLoading && favoriteMediaItems.length > 0 && (
          <div className="relative sm:w-1/2 md:w-1/3">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar nos favoritos..."
              className="w-full pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      {isClient && (storeIsLoading || (epgLoading && Object.keys(epgData).length === 0 && mediaItems.filter(item => favoriteItemIds.includes(item.id)).length > 0)) && <Progress value={progressValue} className="w-full my-4 h-2" />}
      
      {filteredFavoriteItems.length === 0 && debouncedSearchTerm && !storeIsLoading && (
        <div className="text-center py-16 bg-card rounded-lg shadow-md">
          <Search className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <p className="text-xl text-muted-foreground">Nenhum favorito encontrado para "{debouncedSearchTerm}".</p>
          <Button variant="link" onClick={() => setSearchTerm('')} className="mt-4">Limpar Busca</Button>
        </div>
      )}

      {currentItemsToDisplay.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-8">
            {currentItemsToDisplay.map(item => {
              const nowPlayingProgram = item.type === 'channel' ? getNowPlaying(item.tvgId) : null;
              return (
                <MediaCard 
                  key={item.id} 
                  item={item} 
                  nowPlaying={nowPlayingProgram ? nowPlayingProgram.title : undefined} 
                />
              );
            })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-8">
          <Button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            variant="outline"
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            variant="outline"
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
