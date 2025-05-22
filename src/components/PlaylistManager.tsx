"use client";

import React, { useState, useEffect } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export function PlaylistManager() {
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const { playlists, addPlaylist, removePlaylist, isLoading, error, fetchAndParsePlaylists } = usePlaylistStore();
  const { toast } = useToast();

  // Hydrate playlists from store on mount
  useEffect(() => {
    fetchAndParsePlaylists();
  }, [fetchAndParsePlaylists]);


  const handleAddPlaylist = async () => {
    if (!newPlaylistUrl.trim()) {
      toast({
        title: "Error",
        description: "Playlist URL cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    // Basic URL validation
    try {
      new URL(newPlaylistUrl);
    } catch (_) {
      toast({
        title: "Error",
        description: "Invalid URL format.",
        variant: "destructive",
      });
      return;
    }

    await addPlaylist(newPlaylistUrl);
    if (!usePlaylistStore.getState().error) { // Check error state from store after action
      toast({
        title: "Success",
        description: `Playlist from ${newPlaylistUrl} scheduled for addition.`,
      });
      setNewPlaylistUrl('');
    } else {
       toast({
        title: "Error adding playlist",
        description: usePlaylistStore.getState().error,
        variant: "destructive",
      });
    }
  };
  
  const handleRemovePlaylist = (id: string) => {
    removePlaylist(id);
    toast({
      title: "Playlist Removed",
      description: `Playlist has been removed and media items will be updated.`,
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Manage Playlists</CardTitle>
        <CardDescription>Add or remove your M3U playlist URLs here.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex space-x-2">
          <Input
            type="url"
            placeholder="Enter M3U playlist URL (e.g., https://example.com/playlist.m3u)"
            value={newPlaylistUrl}
            onChange={(e) => setNewPlaylistUrl(e.target.value)}
            className="flex-grow"
            aria-label="New playlist URL"
          />
          <Button onClick={handleAddPlaylist} disabled={isLoading} aria-label="Add playlist">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
        
        {isLoading && <p className="text-sm text-muted-foreground">Loading playlists...</p>}

        <h3 className="text-lg font-semibold mt-6 mb-2">Your Playlists:</h3>
        {playlists.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">No playlists added yet.</p>
        ) : (
          <ScrollArea className="h-64 border rounded-md">
            <ul className="p-2 space-y-2">
              {playlists.map((playlist) => (
                <li
                  key={playlist.id}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-md"
                >
                  <div className="truncate">
                    <p className="font-medium truncate" title={playlist.name || playlist.url}>{playlist.name || playlist.url}</p>
                    <p className="text-xs text-muted-foreground truncate" title={playlist.url}>{playlist.url}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemovePlaylist(playlist.id)}
                    disabled={isLoading}
                    aria-label={`Remove playlist ${playlist.name || playlist.url}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Playlists are stored locally in your browser. Media content is fetched on demand.
        </p>
      </CardFooter>
    </Card>
  );
}
