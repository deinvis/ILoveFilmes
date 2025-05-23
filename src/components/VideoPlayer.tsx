
"use client";

import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import type { MediaItem } from '@/types';

interface VideoPlayerProps {
  item: MediaItem;
}

// Helper function to extract YouTube Video ID from various URL formats
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

  useEffect(() => {
    console.log(`VideoPlayer: Attempting to load item: "${item.title}", URL: "${item.streamUrl}"`);
    const videoId = getYouTubeVideoId(item.streamUrl);
    if (videoId) {
      setIsYouTube(true);
      setYouTubeVideoId(videoId);
      // If it's a YouTube video, we don't need to set up HLS or the native video element
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
      return; // Skip HLS/HTML5 setup
    }

    // If not YouTube, reset YouTube states and proceed with HLS/HTML5
    setIsYouTube(false);
    setYouTubeVideoId(null);
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Helper function to log MediaError details
    const logMediaError = (context: string, error: MediaError | null) => {
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
            console.warn(`${context}: ${details}`, error); // Warn for this common error
            break;
          default:
            details += ' (Unknown error code.)';
            console.error(`${context}: ${details}`, error);
        }
      } else {
        console.error(`${context}: An unknown error occurred with the video element.`);
      }
    };
    
    const tryPlay = (element: HTMLVideoElement, sourceDescription: string) => {
      console.log(`Attempting to play: ${sourceDescription} for URL: ${element.src || item.streamUrl}`);
      element.play().catch(error => {
        console.warn(`Autoplay was prevented for ${sourceDescription} (URL: ${element.src || item.streamUrl}):`, error.name, error.message);
      });
    };

    const setupHlsPlayer = () => {
      if (Hls.isSupported()) {
        console.log("VideoPlayer: HLS.js is supported. Setting up HLS player for:", item.streamUrl);
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(item.streamUrl);
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("VideoPlayer HLS.js: Manifest parsed.");
          tryPlay(videoElement, "HLS.js stream");
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('VideoPlayer HLS.js Error:', { event, data });
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('VideoPlayer HLS.js fatal network error:', data.details);
                hls.recoverMediaError();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('VideoPlayer HLS.js fatal media error:', data.details);
                hls.recoverMediaError(); 
                break;
              default:
                console.error('VideoPlayer HLS.js fatal error (other type):', data.type, data.details);
                break;
            }
          } else {
             console.warn('VideoPlayer HLS.js non-fatal error:', data.type, data.details);
          }
        });
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        console.log("VideoPlayer: Native HLS playback is supported. Setting video src to:", item.streamUrl);
        videoElement.src = item.streamUrl;
        videoElement.addEventListener('loadedmetadata', () => {
          console.log("VideoPlayer Native HLS: Metadata loaded.");
          tryPlay(videoElement, "Native HLS stream");
        });
        videoElement.addEventListener('error', () => {
            logMediaError('VideoPlayer Native HLS video element error', videoElement.error);
        });
      } else {
        console.warn("VideoPlayer: HLS.js is not supported, and native HLS playback is not available for this HLS stream. Playback may fail:", item.streamUrl);
        videoElement.src = item.streamUrl; 
        tryPlay(videoElement, "Direct SRC fallback for HLS (unlikely to work)");
         videoElement.addEventListener('error', () => {
            logMediaError('VideoPlayer Direct SRC fallback HLS video element error', videoElement.error);
        });
      }
    };

    const setupDefaultPlayer = () => {
      console.log("VideoPlayer: Setting up default player for non-HLS stream:", item.streamUrl);
      videoElement.src = item.streamUrl;
      videoElement.addEventListener('loadedmetadata', () => {
          console.log("VideoPlayer Default Player: Metadata loaded.");
          tryPlay(videoElement, "Default Player stream");
      });
      videoElement.addEventListener('error', () => {
            logMediaError('VideoPlayer Default Player video element error', videoElement.error);
      });
    };

    if (item.streamUrl && videoElement) { // Ensure videoElement exists
      videoElement.pause();
      videoElement.removeAttribute('src');
      if (hlsRef.current) {
        console.log("VideoPlayer: Destroying previous HLS instance.");
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      videoElement.load(); 

      const lowerStreamUrl = item.streamUrl.toLowerCase();
      const isHlsStream = lowerStreamUrl.includes('.m3u8') || 
                          lowerStreamUrl.includes('/manifest') || 
                          lowerStreamUrl.includes('.isml/manifest');

      if (isHlsStream) {
        setupHlsPlayer();
      } else {
        setupDefaultPlayer();
      }
    }

    return () => {
      console.log("VideoPlayer: Cleaning up for stream:", item.streamUrl);
      if (hlsRef.current) {
        console.log("VideoPlayer: Destroying HLS instance on cleanup.");
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src'); 
        videoElement.load();
      }
    };
  }, [item.streamUrl, item.id, item.title]); // item.id and item.title added for re-triggering effect on item change

  if (isYouTube && youTubeVideoId) {
    return (
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
        <iframe
          src={`https://www.youtube.com/embed/${youTubeVideoId}`}
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
      >
        Your browser does not support the video tag or the video format.
      </video>
    </div>
  );
}
