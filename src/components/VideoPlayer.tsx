
"use client";

import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import type { MediaItem } from '@/types';

interface VideoPlayerProps {
  item: MediaItem;
}

export function VideoPlayer({ item }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Helper function to log MediaError details
    const logMediaError = (context: string, error: MediaError | null) => {
      if (error) {
        let details = `Error Code: ${error.code}`;
        if (error.message) {
          details += `, Message: ${error.message}`;
        }
        // Expand on error codes
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
            // Use console.warn for this specific error to make it less prominent in Next.js error overlay
            console.warn(`${context}: ${details}`, error);
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
        // UI could be updated here to indicate user interaction is needed.
      });
    };

    const setupHlsPlayer = () => {
      if (Hls.isSupported()) {
        console.log("HLS.js is supported. Setting up HLS player for:", item.streamUrl);
        const hls = new Hls({
          // debug: true, 
        });
        hlsRef.current = hls;
        hls.loadSource(item.streamUrl);
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("HLS.js: Manifest parsed.");
          tryPlay(videoElement, "HLS.js stream");
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS.js Error:', { event, data });
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('HLS.js fatal network error:', data.details);
                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                   hls.loadSource(item.streamUrl); 
                } else if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR || data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT) {
                    hls.startLoad(); 
                } else {
                   hls.recoverMediaError();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('HLS.js fatal media error:', data.details);
                if (data.details === 'bufferStalledError' || data.details === 'bufferNudgeOnStall') {
                  console.warn('HLS.js: Buffer issue, trying to recover.');
                  hls.recoverMediaError();
                } else {
                   hls.recoverMediaError(); 
                }
                break;
              default:
                console.error('HLS.js fatal error (other):', data);
                break;
            }
          } else {
             console.warn('HLS.js non-fatal error:', data);
          }
        });
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        console.log("Native HLS playback is supported. Setting video src to:", item.streamUrl);
        videoElement.src = item.streamUrl;
        videoElement.addEventListener('loadedmetadata', () => {
          console.log("Native HLS: Metadata loaded.");
          tryPlay(videoElement, "Native HLS stream");
        });
        videoElement.addEventListener('error', () => {
            logMediaError('Native HLS video element error', videoElement.error);
        });
      } else {
        // This case should ideally not be reached if HLS.isSupported() or native HLS is available.
        // If it is, it means the stream is HLS but cannot be played by either method.
        // For non-HLS streams, setupDefaultPlayer will be called directly.
        console.warn("HLS.js is not supported, and native HLS playback is not available for this HLS stream. Playback may fail:", item.streamUrl);
        // Fallback to setting src directly, though it's unlikely to work for HLS if HLS.js/native support failed.
        videoElement.src = item.streamUrl; 
        tryPlay(videoElement, "Direct SRC fallback for HLS (unlikely to work)");
         videoElement.addEventListener('error', () => {
            logMediaError('Direct SRC fallback HLS video element error', videoElement.error);
        });
      }
    };

    const setupDefaultPlayer = () => {
      console.log("Setting up default player for non-HLS stream:", item.streamUrl);
      videoElement.src = item.streamUrl;
      videoElement.addEventListener('loadedmetadata', () => {
          console.log("Default Player: Metadata loaded.");
          tryPlay(videoElement, "Default Player stream");
      });
      videoElement.addEventListener('error', () => {
            logMediaError('Default Player video element error', videoElement.error);
      });
    };

    if (item.streamUrl) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load(); 

      if (hlsRef.current) {
        console.log("Destroying previous HLS instance.");
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const isHlsStream = item.streamUrl.includes('.m3u8') || 
                          item.streamUrl.includes('/manifest') || 
                          item.streamUrl.includes('.isml/manifest');

      if (isHlsStream) {
        setupHlsPlayer();
      } else {
        setupDefaultPlayer();
      }
    }

    return () => {
      console.log("Cleaning up VideoPlayer for stream:", item.streamUrl);
      if (hlsRef.current) {
        console.log("Destroying HLS instance on cleanup.");
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src'); 
        videoElement.load(); 
        // Cloning to remove listeners is a common pattern, but ensure videoRef.current is updated if needed,
        // or rely on the effect's dependencies to re-run and re-attach listeners to the original ref.
        // For simplicity and given the current structure, this explicit removal might be excessive
        // if the effect correctly cleans up and re-initializes for new `item` prop.
        // const newVideoElement = videoElement.cloneNode(true) as HTMLVideoElement;
        // videoElement.parentNode?.replaceChild(newVideoElement, videoElement);
      }
    };
  }, [item.streamUrl, item.id]); 

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
      <video
        ref={videoRef}
        controls
        className="w-full h-full"
        playsInline // Important for iOS and inline playback
        poster={item.posterUrl} // Display poster before video loads
      >
        Your browser does not support the video tag or the video format.
      </video>
    </div>
  );
}
