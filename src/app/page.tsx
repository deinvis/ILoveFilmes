
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlaylistStore } from '@/store/playlistStore';
import { Skeleton } from '@/components/ui/skeleton'; // For loading UI

export default function HomePage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const preferredStartPage = usePlaylistStore((state) => state.preferredStartPage);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      const targetPage = preferredStartPage || '/app/channels';
      router.replace(targetPage);
    }
  }, [router, preferredStartPage, isClient]);

  // Show a loading skeleton or minimal content while redirecting
  // This prevents layout shifts and provides better UX than null
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background p-8">
      <Skeleton className="h-12 w-1/2 mb-6" />
      <Skeleton className="h-8 w-1/3 mb-4" />
      <Skeleton className="h-8 w-1/3" />
      <p className="text-muted-foreground mt-8">Loading StreamVerse...</p>
    </div>
  );
}
