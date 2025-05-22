"use client";

import React, { useEffect, useRef } from 'react';
import type { MediaItem } from '@/types';

interface VideoPlayerProps {
  item: MediaItem;
}

export function VideoPlayer({ item }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // For future implementation of HLS.js or Dash.js for adaptive streaming and better buffering:
    // if (item.streamUrl.endsWith('.m3u8') && Hls.isSupported()) {
    //   const hls = new Hls();
    //   hls.loadSource(item.streamUrl);
    //   hls.attachMedia(videoRef.current);
    // } else if (videoRef.current) {
    //   videoRef.current.src = item.streamUrl;
    // }
    //
    // The 5-second pre-load buffer mentioned in requirements would typically be handled
    // by such libraries or by custom media source extensions logic.
    // Standard HTML5 video element buffering is browser-dependent.
    if (videoRef.current) {
      videoRef.current.src = item.streamUrl;
    }
  }, [item.streamUrl]);

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
      <video
        ref={videoRef}
        controls
        autoPlay
        className="w-full h-full"
        // poster={item.posterUrl} // Optional: show poster until video loads
      >
        Your browser does not support the video tag.
        {/* Fallback for HLS/DASH could also include tracks for subtitles, etc. */}
      </video>
    </div>
  );
}
