
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

    // Função para tentar iniciar a reprodução e logar erros de autoplay
    const tryPlay = (element: HTMLVideoElement, source: string) => {
      console.log(`Attempting to play ${source}`);
      element.play().catch(error => {
        console.warn(`Autoplay was prevented for ${source}:`, error.name, error.message);
        // Você pode querer atualizar o estado da UI aqui para indicar que o usuário precisa clicar para tocar.
      });
    };

    const setupHlsPlayer = () => {
      if (Hls.isSupported()) {
        console.log("HLS.js is supported. Setting up HLS player for:", item.streamUrl);
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(item.streamUrl);
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("HLS.js: Manifest parsed. Attempting to play.");
          tryPlay(videoElement, "HLS.js stream");
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('HLS.js fatal network error:', data);
                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                    console.error("HLS.js: Failed to load HLS manifest. Check URL and CORS.");
                }
                // Não destruir aqui, pode tentar recoverMediaError
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('HLS.js fatal media error:', data);
                if (data.details === 'bufferStalledError') {
                  console.warn('HLS.js: Buffer stalled, trying to recover.');
                  hls.recoverMediaError();
                } else if (data.details === 'fragParsingError') {
                   console.error('HLS.js: Fragment parsing error. This can be due to malformed segments.');
                   // Não tentar recuperar automaticamente, pode ser um problema persistente no stream
                } else {
                   hls.recoverMediaError();
                }
                break;
              default:
                console.error('HLS.js fatal error (other):', data);
                // Destruir em outros erros fatais pode ser muito agressivo.
                // hls.destroy(); // Comentado para evitar destruição prematura
                // hlsRef.current = null;
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
          console.log("Native HLS: Metadata loaded. Attempting to play.");
          tryPlay(videoElement, "Native HLS stream");
        });
        videoElement.addEventListener('error', (e) => {
            console.error('Native HLS video element error:', videoElement.error);
        });
      } else {
        console.warn("HLS.js is not supported, and native HLS playback is not available. Falling back to direct src.");
        videoElement.src = item.streamUrl; // Fallback for non-HLS or unsupported browsers
        tryPlay(videoElement, "Direct SRC fallback");
      }
    };

    const setupDefaultPlayer = () => {
      console.log("Setting up default player for:", item.streamUrl);
      videoElement.src = item.streamUrl;
      videoElement.addEventListener('loadedmetadata', () => {
          console.log("Default Player: Metadata loaded. Attempting to play.");
          tryPlay(videoElement, "Default Player stream");
      });
      videoElement.addEventListener('error', (e) => {
            console.error('Default Player video element error:', videoElement.error);
      });
    };

    if (item.streamUrl) {
      // Limpar estado anterior do player
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load(); // Reseta o player e cancela downloads pendentes

      if (hlsRef.current) {
        console.log("Destroying previous HLS instance.");
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (item.streamUrl.endsWith('.m3u8') || item.streamUrl.includes('m3u8')) { // Verificação mais flexível para m3u8
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
        // Remover event listeners adicionados explicitamente para evitar memory leaks
        // Embora o React lide com isso para handlers JSX, listeners manuais precisam de limpeza.
        // Mas como estamos recriando o player a cada mudança de item.streamUrl, os listeners são do elemento antigo.
      }
    };
  }, [item.streamUrl, item.id]); // Adicionado item.id para recriar o player se o mesmo streamUrl for usado por outro item.

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
      <video
        ref={videoRef}
        controls
        className="w-full h-full"
        playsInline // Importante para iOS
        poster={item.posterUrl} // Adicionado poster
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
