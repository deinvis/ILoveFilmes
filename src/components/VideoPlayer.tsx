
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

    const setupHlsPlayer = () => {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(item.streamUrl);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoElement.play().catch(error => {
            console.warn("Autoplay was prevented:", error);
            // Autoplay might be blocked by the browser, user interaction might be needed.
          });
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('HLS.js network error:', data);
                // Potentially retry or display error to user
                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                    console.error("Failed to load HLS manifest. Check URL and CORS.");
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('HLS.js media error:', data);
                hls.recoverMediaError();
                break;
              default:
                console.error('HLS.js fatal error:', data);
                hls.destroy();
                hlsRef.current = null;
                break;
            }
          } else {
             console.warn('HLS.js non-fatal error:', data);
          }
        });
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (e.g., Safari)
        videoElement.src = item.streamUrl;
        videoElement.addEventListener('loadedmetadata', () => {
          videoElement.play().catch(error => console.warn("Autoplay was prevented:", error));
        });
      } else {
        console.warn("HLS.js is not supported, and native HLS playback is not available.");
        videoElement.src = item.streamUrl; // Fallback for non-HLS or unsupported browsers
      }
    };

    const setupDefaultPlayer = () => {
      videoElement.src = item.streamUrl;
      videoElement.play().catch(error => console.warn("Autoplay was prevented:", error));
    };

    if (item.streamUrl) {
      if (item.streamUrl.endsWith('.m3u8')) {
        setupHlsPlayer();
      } else {
        setupDefaultPlayer();
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src'); // Detach source
        videoElement.load(); // Reset video element state
      }
    };
  }, [item.streamUrl]);

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
      <video
        ref={videoRef}
        controls
        // autoPlay // Autoplay is handled by HLS.js or directly after src set
        className="w-full h-full"
        playsInline // Important for iOS
        // poster={item.posterUrl} // Optional: show poster until video loads
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
