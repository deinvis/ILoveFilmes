
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePlaylistStore } from '@/store/playlistStore';
import { MediaCard } from '@/components/MediaCard';
import type { MediaItem, MediaType, EpgProgram } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowLeft, Tv2, Film, Clapperboard, ListFilter, Search, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { applyParentalFilter } from '@/lib/parental-filter';
import { processGroupName } from '@/lib/group-name-utils';

const ITEMS_PER_PAGE = 20;
type SortOrder = 'default' | 'title-asc' | 'title-desc';

const MEDIA_TYPE_ICONS: Record<MediaType, React.ElementType> = {
  channel: Tv2,
  movie: Film,
  series: Clapperboard,
};

const MEDIA_TYPE_PATHS: Record<MediaType, string> = {
    channel: '/app/channels',
    movie: '/app/movies',
    series: '/app/series',
};

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  channel: 'canais',
  movie: 'filmes',
  series: 'séries',
};


export default function GroupPage() {
  const params = useParams();
  const router = useRouter();

  const [isClient, setIsClient] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [progressValue, setProgressValue] = useState(10);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  const {
    mediaItems: allMediaItemsFromStore,
    isLoading: storeIsLoading,
    error: storeError,
    fetchAndParsePlaylists,
    epgData,
    epgLoading,
    fetchAndParseEpg,
    parentalControlEnabled
  } = usePlaylistStore();

  const rawMediaType = Array.isArray(params.mediaType) ? params.mediaType[0] : params.mediaType;
  const rawGroupNameFromUrl = Array.isArray(params.groupName) ? params.groupName[0] : params.groupName;

  const mediaType = rawMediaType as MediaType;
  
  const { displayName: pageDisplayGroupName, normalizedKey: pageNormalizedGroupNameKey } = useMemo(() => {
    return processGroupName(rawGroupNameFromUrl ? decodeURIComponent(rawGroupNameFromUrl) : 'UNCATEGORIZED', mediaType);
  }, [rawGroupNameFromUrl, mediaType]);


  useEffect(() => {
    setIsClient(true);
  }, []);

  const rawGroupItems = useMemo(() => {
    if (!mediaType || !pageNormalizedGroupNameKey) return [];
    let items = allMediaItemsFromStore.filter(item => {
      const itemRawGroup = item.groupTitle || (item.type !== 'channel' ? item.genre : undefined) || 'UNCATEGORIZED';
      const { normalizedKey: itemNormalizedKey } = processGroupName(itemRawGroup, item.type);
      return item.type === mediaType && itemNormalizedKey === pageNormalizedGroupNameKey;
    });
    items = applyParentalFilter(items, parentalControlEnabled);
    return items;
  }, [allMediaItemsFromStore, mediaType, pageNormalizedGroupNameKey, parentalControlEnabled]);

  const logicalChannelVariantsMap = useMemo(() => {
    if (mediaType !== 'channel') return new Map<string, MediaItem[]>();
    const map = new Map<string, MediaItem[]>();
    rawGroupItems.forEach(channel => {
        const key = (channel.baseName || channel.title).toUpperCase();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(channel);
    });
    map.forEach(variants => {
        variants.sort((a, b) => 
            (a.qualityTag || 'ZZZ').localeCompare(b.qualityTag || 'ZZZ') ||
            (a.originatingPlaylistName || '').localeCompare(b.originatingPlaylistName || '')
        );
    });
    return map;
  }, [rawGroupItems, mediaType]);

  const logicalGroupItems = useMemo(() => {
    let itemsToSort;
    if (mediaType === 'channel') {
        itemsToSort = Array.from(logicalChannelVariantsMap.values()).map(variants => variants[0]).filter(Boolean) as MediaItem[];
    } else {
        itemsToSort = [...rawGroupItems]; // Create a new array for sorting
    }

    switch (sortOrder) {
      case 'title-asc':
        itemsToSort.sort((a, b) => (a.baseName || a.title).localeCompare(b.baseName || b.title));
        break;
      case 'title-desc':
        itemsToSort.sort((a, b) => (b.baseName || b.title).localeCompare(a.baseName || a.title));
        break;
      // Default: no specific sort here, relies on original order or can be playlist order
    }
    return itemsToSort;
  }, [rawGroupItems, mediaType, logicalChannelVariantsMap, sortOrder]);


  useEffect(() => {
    if (isClient) {
      fetchAndParsePlaylists();
      if (mediaType === 'channel' && usePlaylistStore.getState().epgUrl) {
        fetchAndParseEpg();
      }
    }
  }, [fetchAndParsePlaylists, fetchAndParseEpg, isClient, mediaType]);

  useEffect(() => {
    if (!isClient) return;
    let interval: NodeJS.Timeout | undefined;
    const combinedLoading = storeIsLoading || (mediaType === 'channel' && epgLoading && Object.keys(epgData).length === 0 && logicalGroupItems.length > 0);

    if (combinedLoading) { 
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
  }, [isClient, storeIsLoading, mediaType, epgLoading, epgData, logicalGroupItems]);


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const filteredLogicalGroupItems = useMemo(() => {
    if (!debouncedSearchTerm) return logicalGroupItems;
    return logicalGroupItems.filter(item => {
      return (item.baseName || item.title).toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    });
  }, [logicalGroupItems, debouncedSearchTerm]);

  const totalPages = Math.ceil(filteredLogicalGroupItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItemsToDisplay = filteredLogicalGroupItems.slice(startIndex, endIndex);

  const PageIcon = mediaType ? MEDIA_TYPE_ICONS[mediaType] : ListFilter; 
  const backPath = mediaType ? MEDIA_TYPE_PATHS[mediaType] : '/app'; 
  const mediaTypeLabel = mediaType ? MEDIA_TYPE_LABELS[mediaType] : 'itens'; 

  const getNowPlaying = (tvgId?: string): EpgProgram | null => {
    if (mediaType !== 'channel' || !tvgId || !epgData[tvgId] || epgLoading) return null;
    const now = new Date();
    return epgData[tvgId].find(prog => now >= prog.start && now < prog.end) || null;
  };

  if (!isClient || (storeIsLoading && logicalGroupItems.length === 0 && !debouncedSearchTerm)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-40 mb-2" />
        <Skeleton className="h-12 w-3/4 mb-4" />
        {isClient && (storeIsLoading || (mediaType === 'channel' && epgLoading && Object.keys(epgData).length === 0 && logicalGroupItems.length > 0)) && <Progress value={progressValue} className="w-full my-4 h-2" />}
         <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mb-6">
            <div className="relative flex-grow sm:w-64 md:w-80">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Buscar neste grupo..." className="w-full pl-10" disabled />
            </div>
            <div className="flex items-center gap-2 sm:w-auto">
              <Label htmlFor="sort-group-items" className="text-sm hidden sm:block">Ordenar por:</Label>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)} disabled>
                <SelectTrigger id="sort-group-items" className="w-full sm:w-[180px]">
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
        <Skeleton className="h-10 w-64 mx-auto" />
      </div>
    );
  }

  if (storeError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <AlertTriangle className="w-20 h-20 text-destructive mb-6" />
        <h2 className="text-3xl font-semibold mb-3">Erro ao Carregar Grupo</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">{storeError}</p>
        <Button onClick={() => fetchAndParsePlaylists(true)} size="lg">Tentar Novamente</Button>
        <Button variant="outline" onClick={() => router.push(backPath)} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para {mediaTypeLabel}
        </Button>
      </div>
    );
  }

  if (!mediaType || !pageDisplayGroupName || !['channel', 'movie', 'series'].includes(mediaType)) { 
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <XCircle className="w-20 h-20 text-destructive mb-6" />
        <h2 className="text-3xl font-semibold mb-3">Grupo ou Tipo de Mídia Inválido</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">O grupo ou tipo de mídia solicitado não é válido. Por favor, verifique a URL ou navegue a partir das seções principais.</p>
        <Button onClick={() => router.push('/app')} size="lg">
          <ArrowLeft className="mr-2 h-4 w-4" /> Ir para a Página Principal
        </Button>
      </div>
    );
  }

  if (logicalGroupItems.length === 0 && !storeIsLoading && !(mediaType === 'channel' && epgLoading) && !debouncedSearchTerm) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 rounded-lg bg-card shadow-lg">
        <PageIcon className="w-24 h-24 text-muted-foreground mb-6" />
        <h2 className="text-3xl font-semibold mb-3">Nenhum Item em "{pageDisplayGroupName}"</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md">
          Não há {mediaTypeLabel} listados no grupo "{pageDisplayGroupName}". Isso pode ser devido às configurações de controle parental ou filtros.
        </p>
        <Button onClick={() => router.push(backPath)} size="lg" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para todos os {mediaTypeLabel}
        </Button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
       <Button variant="outline" onClick={() => router.push(backPath)} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para todos os {mediaTypeLabel}
       </Button>

      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center capitalize">
          <PageIcon className="mr-3 h-8 w-8 text-primary" />
          {pageDisplayGroupName} ({filteredLogicalGroupItems.length})
        </h1>
         {logicalGroupItems.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative flex-grow sm:w-64 md:w-80">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                    type="search"
                    placeholder={`Buscar em ${pageDisplayGroupName}...`}
                    className="w-full pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 sm:w-auto">
                  <Label htmlFor="sort-group-items" className="text-sm hidden sm:block">Ordenar por:</Label>
                  <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                    <SelectTrigger id="sort-group-items" className="w-full sm:w-[180px]">
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

      {isClient && (storeIsLoading || (mediaType === 'channel' && epgLoading && Object.keys(epgData).length === 0 && logicalGroupItems.length > 0)) && <Progress value={progressValue} className="w-full my-4 h-2" />}


      {filteredLogicalGroupItems.length === 0 && debouncedSearchTerm && !storeIsLoading && (
        <div className="text-center py-16 bg-card rounded-lg shadow-md">
          <Search className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <p className="text-xl text-muted-foreground">Nenhum {mediaTypeLabel.slice(0, -1)} encontrado em "{pageDisplayGroupName}" para "{debouncedSearchTerm}".</p>
           <Button variant="link" onClick={() => setSearchTerm('')} className="mt-4">Limpar Busca</Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-8">
        {currentItemsToDisplay.map(representativeItem => {
          const allVariantsForThisChannel = mediaType === 'channel' 
            ? logicalChannelVariantsMap.get((representativeItem.baseName || representativeItem.title).toUpperCase()) 
            : undefined;
          const nowPlayingProgram = mediaType === 'channel' ? getNowPlaying(representativeItem.tvgId) : null;
          return (
            <MediaCard
              key={`${(representativeItem.baseName || representativeItem.title)}-${representativeItem.id}`}
              item={representativeItem}
              allChannelVariants={allVariantsForThisChannel}
              nowPlaying={nowPlayingProgram ? nowPlayingProgram.title : undefined}
            />
          );
        })}
      </div>

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
       {logicalGroupItems.length > 0 && filteredLogicalGroupItems.length === 0 && !debouncedSearchTerm && !storeIsLoading && (
         <div className="text-center py-16 bg-card rounded-lg shadow-md">
           <PageIcon className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
           <p className="text-xl text-muted-foreground">Nenhum {mediaTypeLabel.slice(0, -1)} para exibir em "{pageDisplayGroupName}" com os filtros atuais.</p>
         </div>
       )}
    </div>
  );
}

