
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlaylistStore } from '@/store/playlistStore';
import { Skeleton } from '@/components/ui/skeleton'; // For loading UI

// This page handles direct navigation to /app and redirects to the user's preferred start page.
export default function AppRootPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const preferredStartPage = usePlaylistStore((state) => state.preferredStartPage);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      const targetPage = preferredStartPage || '/app/channels';
      // If already on the target page (e.g., /app/channels and target is /app/channels),
      // this check might be redundant if `router.replace` handles it efficiently,
      // but it's a small safeguard against potential loops or unnecessary replaces.
      if (router.pathname !== targetPage) {
        router.replace(targetPage);
      }
    }
  }, [router, preferredStartPage, isClient]);

  // Show a loading skeleton or minimal content while redirecting
  return (
     <div className="flex flex-col items-center justify-center h-full p-8"> {/* Changed h-screen to h-full for app layout context */}
      <Skeleton className="h-12 w-1/2 mb-6" />
      <Skeleton className="h-8 w-1/3 mb-4" />
      <Skeleton className="h-8 w-1/3" />
      <p className="text-muted-foreground mt-8">Loading your preferred view...</p>
    </div>
  );
}
