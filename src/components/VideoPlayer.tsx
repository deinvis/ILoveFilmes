
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

function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2] && match[2].length === 11) ? match[2] : null;
}

export function VideoPlayer({ item }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isYouTube, setIsYouTube] = useState(false);
  const [youTubeVideoId, setYouTubeVideoId] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const { updatePlaybackProgress, getPlaybackProgress, addRecentlyPlayed } = usePlaylistStore();

  const logMediaError = useCallback((context: string, error: MediaError | null, streamUrl?: string) => {
    let userFriendlyMessage = "Ocorreu um erro desconhecido ao tentar reproduzir o vídeo.";
    if (error) {
      let details = `Error Code: ${error.code}`;
      if (error.message) {
        details += `, Message: ${error.message}`;
      }
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          details += ' (The fetching process for the media resource was aborted by the user.)';
          userFriendlyMessage = "A reprodução foi interrompida.";
          console.warn(`${context}: ${details}`, error);
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          details += ' (A network error occurred while fetching the media resource.)';
          userFriendlyMessage = "Erro de rede ao tentar carregar o vídeo. Verifique sua conexão.";
          console.error(`${context}: ${details}`, error);
          break;
        case MediaError.MEDIA_ERR_DECODE:
          details += ' (An error occurred while decoding the media resource, possibly due to corruption or unsupported codecs.)';
          userFriendlyMessage = "Erro ao decodificar o vídeo. O arquivo pode estar corrompido ou em um formato não suportado.";
          console.error(`${context}: ${details}`, error);
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          details += ' (The media resource specified by src was not suitable or the format is not supported.)';
          userFriendlyMessage = "Formato de vídeo não suportado ou fonte inválida.";
          if (streamUrl && streamUrl.toLowerCase().endsWith('.ts')) {
            userFriendlyMessage += " Streams .ts podem ter compatibilidade limitada no navegador. Verifique se há uma versão .m3u8 (HLS) disponível na sua playlist.";
          }
          console.warn(`${context}: ${details} (URL: ${streamUrl})`, error);
          break;
        default:
          details += ' (Unknown error code.)';
          console.error(`${context}: ${details}`, error);
      }
    } else {
      console.error(`${context}: An unknown error occurred with the video element.`);
    }
    setPlayerError(userFriendlyMessage);
  }, [setPlayerError]);

  const tryPlay = useCallback((element: HTMLVideoElement, sourceDescription: string) => {
    console.log(`VideoPlayer: Attempting to play: ${sourceDescription} for URL: ${element.src || item.streamUrl}`);
    element.play().catch(error => {
      console.warn(`VideoPlayer: Autoplay/play was prevented for ${sourceDescription} (URL: ${element.src || item.streamUrl}):`, error.name, error.message);
      // setPlayerError("Não foi possível iniciar a reprodução automaticamente. Clique no play.");
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

  const setupVideoEventListeners = useCallback((videoElement: HTMLVideoElement) => {
    const onLoadedMetadata = () => {
      console.log("VideoPlayer: Metadata loaded for", item.streamUrl);
      setPlayerError(null); 
      if (item.type === 'movie' || item.type === 'series') {
        const savedProgress = getPlaybackProgress(item.id);
        if (savedProgress && videoElement.duration > 0 && videoElement.currentTime < savedProgress.currentTime && savedProgress.currentTime < videoElement.duration -1) { 
          console.log(`VideoPlayer: Resuming VOD item "${item.title}" from ${savedProgress.currentTime}s`);
          videoElement.currentTime = savedProgress.currentTime;
        }
      }
      tryPlay(videoElement, `Video stream (loadedmetadata event): ${item.streamUrl}`);
    };

    const onError = () => {
      logMediaError(`VideoPlayer Error for ${item.title} (${item.streamUrl})`, videoElement.error, item.streamUrl);
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
  }, [item, tryPlay, logMediaError, getPlaybackProgress, handleTimeUpdate, setPlayerError]);


  useEffect(() => {
    console.log(`VideoPlayer: Attempting to load item: "${item.title}", URL: "${item.streamUrl}"`);
    setPlayerError(null); 
    addRecentlyPlayed(item.id);

    const videoId = getYouTubeVideoId(item.streamUrl);
    if (videoId) {
      console.log("VideoPlayer: Detected YouTube video. ID:", videoId);
      setIsYouTube(true);
      setYouTubeVideoId(videoId);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
      }
      return;
    }

    setIsYouTube(false);
    setYouTubeVideoId(null);
    const videoElement = videoRef.current;
    if (!videoElement) return;

    let cleanupVideoEvents: (() => void) | undefined;

    const setupHlsPlayer = () => {
      if (Hls.isSupported()) {
        console.log("VideoPlayer: HLS.js is supported. Setting up HLS player for:", item.streamUrl);
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(item.streamUrl);
        hls.attachMedia(videoElement);

        cleanupVideoEvents = setupVideoEventListeners(videoElement); 

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("VideoPlayer HLS.js: Manifest parsed for", item.streamUrl);
          setPlayerError(null); 
          tryPlay(videoElement, `HLS stream (manifest parsed event): ${item.streamUrl}`);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          logMediaError(`HLS.js Error for ${item.title} - Event: ${event}, Details: ${data.details}`, videoElement.error, item.streamUrl); 
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
                hls.startLoad(); 
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                userFriendlyHlsError = `Erro de mídia no stream HLS: ${data.details}. O conteúdo pode estar corrompido ou em formato não suportado.`;
                if (data.details === Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR) {
                     userFriendlyHlsError = "Codecs de vídeo/áudio no stream HLS são incompatíveis com seu navegador."
                }
                hls.recoverMediaError(); 
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
        console.log("VideoPlayer: Native HLS playback is supported. Setting video src to:", item.streamUrl);
        videoElement.src = item.streamUrl;
        cleanupVideoEvents = setupVideoEventListeners(videoElement);
      } else {
        const unsupportedMessage = "Seu navegador não suporta HLS.js nem reprodução nativa de HLS para este stream.";
        console.warn("VideoPlayer: HLS.js is not supported, and native HLS playback is not available for this HLS stream. Playback may fail:", item.streamUrl);
        setPlayerError(unsupportedMessage);
        videoElement.src = item.streamUrl; 
        cleanupVideoEvents = setupVideoEventListeners(videoElement);
      }
    };

    const setupDefaultPlayer = () => {
      console.log(`VideoPlayer: Setting up default HTML5 player for non-HLS stream: "${item.streamUrl}" (Item: "${item.title}")`);
      videoElement.src = item.streamUrl;
      videoElement.preload = "auto"; 
      cleanupVideoEvents = setupVideoEventListeners(videoElement);
    };

    if (item.streamUrl && videoElement) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      if (hlsRef.current) {
        console.log("VideoPlayer: Destroying previous HLS instance for new item:", item.title);
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      videoElement.load();

      const lowerStreamUrl = item.streamUrl.toLowerCase();
      const isHlsStream = lowerStreamUrl.includes('.m3u8') || 
                          lowerStreamUrl.includes('/manifest') || 
                          lowerStreamUrl.includes('.isml/manifest');

      if (isHlsStream) {
        console.log(`VideoPlayer: Detected HLS stream for ${item.title}: ${item.streamUrl}`);
        setupHlsPlayer();
      } else {
        console.log(`VideoPlayer: Detected non-HLS (likely direct) stream for ${item.title}: ${item.streamUrl}`);
        setupDefaultPlayer();
      }
    }

    return () => {
      console.log("VideoPlayer: Cleaning up for stream:", item.streamUrl, "(Item:", item.title, ")");
      if (cleanupVideoEvents) {
        cleanupVideoEvents();
      }
      if (hlsRef.current) {
        console.log("VideoPlayer: Destroying HLS instance on cleanup for item:", item.title);
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src'); 
        videoElement.load(); 
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.streamUrl, item.title, item.type]); // Simplified dependencies

  if (isYouTube && youTubeVideoId) {
    return (
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl relative">
        <iframe
          src={`https://www.youtube.com/embed/${youTubeVideoId}?autoplay=1`}
          title={item.title || "YouTube video player"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
        ></iframe>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl relative">
      <video
        ref={videoRef}
        controls
        className="w-full h-full"
        playsInline 
        poster={item.posterUrl}
        preload="auto" // Changed from "metadata" to "auto" for potentially better default player buffering
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
    
