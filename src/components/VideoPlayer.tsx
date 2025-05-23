
"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import type { MediaItem } from '@/types';
import { usePlaylistStore } from '@/store/playlistStore';

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
  const [isYouTube, setIsYouTube] = React.useState(false);
  const [youTubeVideoId, setYouTubeVideoId] = React.useState<string | null>(null);

  const { updatePlaybackProgress, getPlaybackProgress, addRecentlyPlayed } = usePlaylistStore();

  const logMediaError = useCallback((context: string, error: MediaError | null) => {
    if (error) {
      let details = `Error Code: ${error.code}`;
      if (error.message) {
        details += `, Message: ${error.message}`;
      }
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          details += ' (The fetching process for the media resource was aborted by the user.)';
          console.error(`${context}: ${details}`, error);
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          details += ' (A network error occurred while fetching the media resource.)';
          console.error(`${context}: ${details}`, error);
          break;
        case MediaError.MEDIA_ERR_DECODE:
          details += ' (An error occurred while decoding the media resource, possibly due to corruption or unsupported codecs.)';
          console.error(`${context}: ${details}`, error);
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          details += ' (The media resource specified by src was not suitable or the format is not supported.)';
          console.warn(`${context}: ${details}`, error); // Changed to warn for this specific error
          break;
        default:
          details += ' (Unknown error code.)';
          console.error(`${context}: ${details}`, error);
      }
    } else {
      console.error(`${context}: An unknown error occurred with the video element.`);
    }
  }, []);

  const tryPlay = useCallback((element: HTMLVideoElement, sourceDescription: string) => {
    console.log(`VideoPlayer: Attempting to play: ${sourceDescription} for URL: ${element.src || item.streamUrl}`);
    element.play().catch(error => {
      console.warn(`VideoPlayer: Autoplay/play was prevented for ${sourceDescription} (URL: ${element.src || item.streamUrl}):`, error.name, error.message);
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
      console.log("VideoPlayer: Metadata loaded.");
      if (item.type === 'movie' || item.type === 'series') {
        const savedProgress = getPlaybackProgress(item.id);
        if (savedProgress && videoElement.duration > 0) { 
          console.log(`VideoPlayer: Resuming VOD item "${item.title}" from ${savedProgress.currentTime}s`);
          videoElement.currentTime = savedProgress.currentTime;
        }
      }
      tryPlay(videoElement, "Video stream (loadedmetadata event)");
    };

    const onError = () => {
      logMediaError(`VideoPlayer Error for ${item.title}`, videoElement.error);
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
    console.log(`VideoPlayer: Attempting to load item: "${item.title}", URL: "${item.streamUrl}"`);
    addRecentlyPlayed(item.id); // Add to recently played when player attempts to load

    const videoId = getYouTubeVideoId(item.streamUrl);
    if (videoId) {
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
          console.log("VideoPlayer HLS.js: Manifest parsed.");
          tryPlay(videoElement, "HLS stream (manifest parsed event)");
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          logMediaError(`VideoPlayer HLS.js Error for ${item.title} - Event: ${event}, Details: ${data.details}`, data.type === Hls.ErrorTypes.MEDIA_ERROR ? videoElement.error : null);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('VideoPlayer HLS.js fatal network error:', data.details, 'Attempting to recover...');
                hls.startLoad(); // Or hls.recoverMediaError() for specific media errors
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('VideoPlayer HLS.js fatal media error:', data.details, 'Attempting to recover...');
                hls.recoverMediaError(); 
                break;
              default:
                console.error('VideoPlayer HLS.js fatal error (other type):', data.type, data.details);
                // Consider not re-throwing or destroying HLS instance for certain errors
                // to allow manual recovery or user intervention if possible.
                break;
            }
          } else {
             console.warn('VideoPlayer HLS.js non-fatal error:', data.type, data.details);
          }
        });
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        console.log("VideoPlayer: Native HLS playback is supported. Setting video src to:", item.streamUrl);
        videoElement.src = item.streamUrl;
        cleanupVideoEvents = setupVideoEventListeners(videoElement);
      } else {
        console.warn("VideoPlayer: HLS.js is not supported, and native HLS playback is not available for this HLS stream. Playback may fail:", item.streamUrl);
        videoElement.src = item.streamUrl; // Fallback to trying native playback anyway
        cleanupVideoEvents = setupVideoEventListeners(videoElement);
      }
    };

    const setupDefaultPlayer = () => {
      console.log("VideoPlayer: Setting up default player for non-HLS stream:", item.streamUrl);
      videoElement.src = item.streamUrl;
      videoElement.preload = "metadata"; // Load only metadata until play is initiated
      cleanupVideoEvents = setupVideoEventListeners(videoElement);
    };

    if (item.streamUrl && videoElement) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      if (hlsRef.current) {
        console.log("VideoPlayer: Destroying previous HLS instance.");
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      videoElement.load(); // Important to reset the video element state

      const lowerStreamUrl = item.streamUrl.toLowerCase();
      // Improved HLS stream detection
      const isHlsStream = lowerStreamUrl.includes('.m3u8') || 
                          lowerStreamUrl.includes('/manifest') || // Common in DASH but sometimes used for HLS proxies
                          lowerStreamUrl.includes('.isml/manifest'); // Smooth Streaming manifest, sometimes gateway to HLS

      if (isHlsStream) {
        setupHlsPlayer();
      } else {
        setupDefaultPlayer();
      }
    }

    return () => {
      console.log("VideoPlayer: Cleaning up for stream:", item.streamUrl);
      if (cleanupVideoEvents) {
        cleanupVideoEvents();
      }
      if (hlsRef.current) {
        console.log("VideoPlayer: Destroying HLS instance on cleanup.");
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src'); 
        // Remove event listeners specifically attached here if not covered by cleanupVideoEvents
        videoElement.load(); // Reset the video element
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, setupVideoEventListeners, logMediaError, tryPlay, addRecentlyPlayed]); // Added addRecentlyPlayed to dependency array

  if (isYouTube && youTubeVideoId) {
    return (
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
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
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
      <video
        ref={videoRef}
        controls
        className="w-full h-full"
        playsInline 
        poster={item.posterUrl}
        preload="metadata" 
      >
        Your browser does not support the video tag or the video format.
      </video>
    </div>
  );
}
