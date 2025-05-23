
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

    console.log(`VideoPlayer: Attempting to load item: "${item.title}", URL: "${item.streamUrl}"`);

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
        console.log("VideoPlayer: HLS.js is supported. Setting up HLS player for:", item.streamUrl);
        const hls = new Hls({
          // debug: true, // Enable for more detailed HLS.js logs if needed
        });
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
                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                   // Optionally retry manifest load
                   // hls.loadSource(item.streamUrl); 
                } else if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR || data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT) {
                    // Optionally retry fragment load
                    // hls.startLoad(); 
                } else {
                   // Attempt to recover from other network errors
                   hls.recoverMediaError();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('VideoPlayer HLS.js fatal media error:', data.details);
                if (data.details === 'bufferStalledError' || data.details === 'bufferNudgeOnStall') {
                  console.warn('VideoPlayer HLS.js: Buffer issue, trying to recover.');
                  hls.recoverMediaError();
                } else {
                   // Attempt to recover from other media errors
                   hls.recoverMediaError(); 
                }
                break;
              default:
                console.error('VideoPlayer HLS.js fatal error (other type):', data.type, data.details);
                // Potentially destroy and re-initialize HLS on some unrecoverable errors
                // hls.destroy();
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

    if (item.streamUrl) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      // Ensure any previous HLS instance is cleaned up before setting up a new one or a new src.
      if (hlsRef.current) {
        console.log("VideoPlayer: Destroying previous HLS instance.");
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      videoElement.load(); // Reset the media element

      // Improved HLS stream detection
      const lowerStreamUrl = item.streamUrl.toLowerCase();
      const isHlsStream = lowerStreamUrl.includes('.m3u8') || 
                          lowerStreamUrl.includes('/manifest') || // Common pattern for HLS/DASH manifests
                          lowerStreamUrl.includes('.isml/manifest'); // Smooth Streaming that might serve HLS

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
        // Removing event listeners manually can be complex, relying on component unmount
        // and re-mount for new `item` is often sufficient if dependencies are correct.
      }
    };
  }, [item.streamUrl, item.id, item.title]); // Added item.title for logging convenience in useEffect

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
