"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page will redirect to /app/channels as the main dashboard/landing for the app.
export default function AppRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/app/channels');
  }, [router]);

  // You can show a loading spinner or some minimal content here while redirecting
  return (
    <div className="flex items-center justify-center h-screen">
      <p>Loading StreamVerse...</p>
    </div>
  );
}
