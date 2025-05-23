
"use client";

import React, { useState, useEffect } from 'react';
import { PlaylistManager } from '@/components/PlaylistManager';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Palette, ListPlus, CalendarDays, Save } from 'lucide-react';
import { usePlaylistStore } from '@/store/playlistStore';
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { epgUrl, setEpgUrl, epgLoading, epgError } = usePlaylistStore();
  const [currentEpgUrl, setCurrentEpgUrl] = useState(epgUrl || '');
  const { toast } = useToast();

  useEffect(() => {
    setCurrentEpgUrl(epgUrl || '');
  }, [epgUrl]);

  const handleSaveEpgUrl = async () => {
    if (!currentEpgUrl.trim()) {
      await setEpgUrl(null);
       toast({
        title: "EPG URL Cleared",
        description: "EPG URL has been removed.",
      });
      return;
    }
    try {
      new URL(currentEpgUrl); // Basic URL validation
      await setEpgUrl(currentEpgUrl);
      toast({
        title: "EPG URL Saved",
        description: "EPG data will be fetched and updated.",
      });
    } catch (_) {
      toast({
        title: "Invalid EPG URL",
        description: "Please enter a valid URL format for the EPG.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><Palette className="mr-3 h-6 w-6 text-primary" /> Theme Settings</CardTitle>
          <CardDescription>Customize the look and feel of StreamVerse.</CardDescription>
        </CardHeader>
        <CardContent className="w-full sm:w-1/2 lg:w-1/3">
          <ThemeToggle />
        </CardContent>
      </Card>
      
      <Separator />

      <Card className="shadow-lg">
         <CardHeader>
          <CardTitle className="flex items-center text-xl"><ListPlus className="mr-3 h-6 w-6 text-primary" /> Playlist Settings</CardTitle>
          <CardDescription>Manage your M3U playlist sources.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlaylistManager />
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><CalendarDays className="mr-3 h-6 w-6 text-primary" /> EPG (Electronic Program Guide) Settings</CardTitle>
          <CardDescription>Set your XMLTV EPG URL to get program information for your channels.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2 items-center">
            <Input
              type="url"
              placeholder="Enter XMLTV EPG URL (e.g., https://example.com/epg.xml)"
              value={currentEpgUrl}
              onChange={(e) => setCurrentEpgUrl(e.target.value)}
              className="flex-grow"
              aria-label="EPG URL"
            />
            <Button onClick={handleSaveEpgUrl} disabled={epgLoading}>
              <Save className="mr-2 h-4 w-4" />
              {epgLoading ? 'Saving...' : 'Save EPG'}
            </Button>
          </div>
          {epgError && (
            <p className="text-sm text-destructive">{epgError}</p>
          )}
          {epgLoading && (
            <p className="text-sm text-muted-foreground">Fetching and processing EPG data...</p>
          )}
          {epgUrl && !epgLoading && !epgError && (
             <p className="text-sm text-green-600">EPG data loaded successfully from: {epgUrl}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
