
"use client";

import React, { useEffect, useRef, useCallback, useState } from 'react';
import Hls from 'hls.js';
import type { MediaItem } from '@/types';
import { usePlaylistStore } from '@/store/playlistStore';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';

interface VideoPlayerProps {
  item: MediaItem;
}

export function VideoPlayer({ item }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const { updatePlaybackProgress, getPlaybackProgress } = usePlaylistStore();

  const logMediaError = useCallback((context: string, error: MediaError | null, streamUrl?: string) => {
    let userFriendlyMessage = "Ocorreu um erro desconhecido ao tentar reproduzir o vídeo.";
    // Use console.warn for MEDIA_ERR_SRC_NOT_SUPPORTED (code 4)
    // to make it less prominent in Next.js error overlay for common format issues.
    const consoleLogFn = error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ? console.warn : console.error;

    if (error) {
      let details = `Error Code: ${error.code}`;
      if (error.message) {
        details += `, Message: ${error.message}`;
      }
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          details += ' (A busca pelo recurso de mídia foi abortada pelo usuário.)';
          userFriendlyMessage = "A reprodução foi interrompida.";
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          details += ' (Ocorreu um erro de rede ao buscar o recurso de mídia.)';
          userFriendlyMessage = "Erro de rede ao tentar carregar o vídeo. Verifique sua conexão.";
          break;
        case MediaError.MEDIA_ERR_DECODE:
          details += ' (Ocorreu um erro ao decodificar o recurso de mídia, possivelmente devido a corrupção ou codecs não suportados.)';
          userFriendlyMessage = "Erro ao decodificar o vídeo. O arquivo pode estar corrompido ou em um formato não suportado.";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          details += ' (O recurso de mídia especificado por src não era adequado ou o formato não é suportado.)';
          userFriendlyMessage = "Formato de vídeo não suportado ou fonte inválida.";
          if (streamUrl && streamUrl.toLowerCase().endsWith('.ts')) {
            userFriendlyMessage += " Streams .ts podem ter compatibilidade limitada no navegador. Verifique se há uma versão .m3u8 (HLS) disponível na sua playlist.";
          }
          break;
        default:
          details += ' (Código de erro desconhecido.)';
      }
      consoleLogFn(`${context}: ${details}`, error);
    } else {
      consoleLogFn(`${context}: Ocorreu um erro desconhecido com o elemento de vídeo.`);
    }
    setPlayerError(userFriendlyMessage);
  }, [setPlayerError]);

  const tryPlay = useCallback((element: HTMLVideoElement, sourceDescription: string) => {
    console.log(`VideoPlayer: Tentando reproduzir: ${sourceDescription} para URL: ${element.src || item.streamUrl}`);
    element.play()
      .then(() => {
        console.log(`VideoPlayer: Play promise resolvido para ${sourceDescription} (URL: ${element.src || item.streamUrl})`);
        setPlayerError(null); // Clear previous errors on successful play start
      })
      .catch(error => {
        console.warn(`VideoPlayer: Play promise rejeitado para ${sourceDescription} (URL: ${element.src || item.streamUrl}):`, error.name, error.message);
        // Do not set playerError here for autoplay block, user can still click play.
        // But if it's a general error after explicit play, it might be set by the 'error' event listener.
      });
  }, [item.streamUrl]);

  const handleTimeUpdate = useCallback(() => {
    const videoElement = videoRef.current;
    if (videoElement && (item.type === 'movie' || item.type === 'series')) {
      if (videoElement.duration && videoElement.currentTime) {
         updatePlaybackProgress(item.id, videoElement.currentTime, videoElement.duration);
      }
    }
  }, [item.id, item.type, updatePlaybackProgress]);

  const setupVideoEventListeners = useCallback((videoElement: HTMLVideoElement, playerType: 'HLS' | 'Default') => {
    const onLoadedMetadata = () => {
      console.log(`VideoPlayer (${playerType}): Metadados carregados para`, item.streamUrl);
      setPlayerError(null); 
      if (item.type === 'movie' || item.type === 'series') {
        const savedProgress = getPlaybackProgress(item.id);
        if (savedProgress && videoElement.duration > 0 && videoElement.currentTime < savedProgress.currentTime && savedProgress.currentTime < videoElement.duration -1 ) { 
          console.log(`VideoPlayer (${playerType}): Retomando VOD item "${item.title}" de ${savedProgress.currentTime}s`);
          videoElement.currentTime = savedProgress.currentTime;
        }
      }
      tryPlay(videoElement, `${playerType} stream (loadedmetadata event): ${item.streamUrl}`);
    };

    const onError = () => {
      logMediaError(`VideoPlayer (${playerType}) Erro para ${item.title} (${item.streamUrl})`, videoElement.error, item.streamUrl);
    };
    
    videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
    videoElement.addEventListener('error', onError);
    if (item.type === 'movie' || item.type === 'series') {
      videoElement.addEventListener('timeupdate', handleTimeUpdate);
    }

    return () => {
      videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoElement.removeEventListener('error', onError);
      if (item.type === 'movie' || item.type === 'series') {
        videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      }
    };
  }, [item, tryPlay, logMediaError, getPlaybackProgress, handleTimeUpdate]);


  useEffect(() => {
    console.log(`VideoPlayer: Carregando item: "${item.title}", URL: "${item.streamUrl}", ID: ${item.id}`);
    setPlayerError(null);

    const videoElement = videoRef.current;
    if (!videoElement) return;

    let cleanupVideoEvents: (() => void) | undefined;

    // Destroy previous HLS instance if it exists
    if (hlsRef.current) {
      console.log("VideoPlayer: Destruindo instância HLS anterior para o novo item:", item.title);
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    // Reset video element before loading new source
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load(); // Resets the media element to its initial state

    const lowerStreamUrl = item.streamUrl.toLowerCase();
    const isHlsStream = lowerStreamUrl.includes('.m3u8') || 
                        lowerStreamUrl.includes('/manifest') || 
                        lowerStreamUrl.includes('.isml/manifest');

    if (isHlsStream) {
      console.log(`VideoPlayer: Configurando player HLS para stream: "${item.streamUrl}"`);
      if (Hls.isSupported()) {
        console.log("VideoPlayer: HLS.js é suportado.");
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(item.streamUrl);
        hls.attachMedia(videoElement);

        cleanupVideoEvents = setupVideoEventListeners(videoElement, 'HLS'); 

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("VideoPlayer HLS.js: Manifesto parseado para", item.streamUrl);
          tryPlay(videoElement, `HLS stream (manifest parsed event): ${item.streamUrl}`);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          let userFriendlyHlsError = "Erro ao carregar o stream de vídeo (HLS).";
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                userFriendlyHlsError = `Erro de rede ao carregar o stream HLS: ${data.details}. Verifique sua conexão.`;
                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                    userFriendlyHlsError = "Não foi possível carregar o manifesto do stream HLS. A fonte pode estar offline ou inacessível."
                } else if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR || data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT) {
                     userFriendlyHlsError = "Erro ao carregar um segmento do vídeo HLS. A conexão pode estar instável ou o stream pode estar incompleto."
                }
                if (hlsRef.current) hlsRef.current.startLoad(); 
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                userFriendlyHlsError = `Erro de mídia no stream HLS: ${data.details}. O conteúdo pode estar corrompido ou em formato não suportado.`;
                if (data.details === Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR) {
                     userFriendlyHlsError = "Codecs de vídeo/áudio no stream HLS são incompatíveis com seu navegador."
                }
                if (hlsRef.current) hlsRef.current.recoverMediaError(); 
                break;
              default:
                userFriendlyHlsError = `Erro fatal ao carregar o stream HLS: ${data.details}.`;
                break;
            }
          } else {
             userFriendlyHlsError = `Problema no stream HLS: ${data.details}.`;
          }
          setPlayerError(userFriendlyHlsError);
          console.error('HLS.js error:', event, data, 'for URL:', item.streamUrl);
        });
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        console.log("VideoPlayer: HLS Nativo é suportado. Definindo src do vídeo para:", item.streamUrl);
        videoElement.src = item.streamUrl;
        cleanupVideoEvents = setupVideoEventListeners(videoElement, 'HLS');
      } else {
        const unsupportedMessage = "Seu navegador não suporta HLS.js nem reprodução nativa de HLS para este stream.";
        console.warn("VideoPlayer: HLS.js não é suportado e HLS nativo não está disponível. A reprodução pode falhar:", item.streamUrl);
        setPlayerError(unsupportedMessage);
        videoElement.src = item.streamUrl; 
        cleanupVideoEvents = setupVideoEventListeners(videoElement, 'HLS');
      }
    } else {
      console.log(`VideoPlayer: Configurando player HTML5 padrão para stream não-HLS: "${item.streamUrl}" (Item: "${item.title}")`);
      videoElement.src = item.streamUrl;
      cleanupVideoEvents = setupVideoEventListeners(videoElement, 'Default');
      // tryPlay for default player is handled by onLoadedMetadata
    }

    return () => {
      console.log("VideoPlayer: Limpando para stream:", item.streamUrl, "(Item:", item.title, ")");
      if (cleanupVideoEvents) {
        cleanupVideoEvents();
      }
      if (hlsRef.current) {
        console.log("VideoPlayer: Destruindo instância HLS na limpeza para o item:", item.title);
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src'); 
        videoElement.load(); 
      }
    };
  }, [item.id, item.streamUrl, item.title, item.type, getPlaybackProgress, updatePlaybackProgress, logMediaError, tryPlay, setupVideoEventListeners]);

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl relative">
      <video
        ref={videoRef}
        controls
        className="w-full h-full"
        playsInline 
        poster={item.posterUrl}
        preload="auto" // Changed from metadata as "auto" might behave better with direct play attempts
      >
        Seu navegador não suporta a tag de vídeo ou o formato do vídeo.
      </video>
      {playerError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 z-10">
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Erro ao Reproduzir</AlertTitle>
            <AlertDescription>{playerError}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
