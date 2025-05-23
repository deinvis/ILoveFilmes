
"use client";

import React, { useState, useEffect } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, AlertCircle, ListVideo } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Label } from '@/components/ui/label';

export function PlaylistManager() {
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState(''); // New state for playlist name
  const { playlists, addPlaylist, removePlaylist, isLoading, error, fetchAndParsePlaylists } = usePlaylistStore();
  const { toast } = useToast();

  useEffect(() => {
    if (playlists.length === 0 && !isLoading) { // Fetch only if playlists are empty and not already loading
        fetchAndParsePlaylists();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed fetchAndParsePlaylists from dependencies to avoid re-fetching on every render


  const handleAddPlaylist = async () => {
    if (!newPlaylistUrl.trim()) {
      toast({
        title: "Error",
        description: "Playlist URL cannot be empty.",
        variant: "destructive",
      });
      return;
    }
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

    await addPlaylist(newPlaylistUrl, newPlaylistName.trim() || undefined); // Pass the custom name
    
    // Check error state from store after action
    const currentError = usePlaylistStore.getState().error; 
    if (!currentError || !currentError.includes(newPlaylistUrl)) { // Be more specific about error context if possible
      toast({
        title: "Success",
        description: `Playlist ${newPlaylistName.trim() || newPlaylistUrl} scheduled for addition.`,
      });
      setNewPlaylistUrl('');
      setNewPlaylistName(''); // Clear the name input
    } else {
       toast({
        title: "Error adding playlist",
        description: currentError, // Display the specific error from the store
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
        <CardTitle className="text-2xl font-bold flex items-center">
          <ListVideo className="mr-3 h-7 w-7 text-primary" /> Manage Playlists
        </CardTitle>
        <CardDescription>Add or remove your M3U playlist URLs here.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && !isLoading && ( // Only show general error if not loading
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-4">
          <div>
            <Label htmlFor="playlist-url" className="mb-1.5 block text-sm font-medium">Playlist URL*</Label>
            <Input
              id="playlist-url"
              type="url"
              placeholder="Enter M3U playlist URL (e.g., https://example.com/playlist.m3u)"
              value={newPlaylistUrl}
              onChange={(e) => setNewPlaylistUrl(e.target.value)}
              className="flex-grow"
              aria-label="New playlist URL"
            />
          </div>
          <div>
            <Label htmlFor="playlist-name" className="mb-1.5 block text-sm font-medium">Playlist Name (Optional)</Label>
            <Input
              id="playlist-name"
              type="text"
              placeholder="My Awesome Playlist"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-grow"
              aria-label="New playlist name (optional)"
            />
          </div>
          <Button onClick={handleAddPlaylist} disabled={isLoading} aria-label="Add playlist" className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" />
            {isLoading ? 'Adding...' : 'Add Playlist'}
          </Button>
        </div>
        
        {isLoading && playlists.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Loading playlists for the first time...</p>}

        <h3 className="text-lg font-semibold mt-6 mb-2">Your Playlists ({playlists.length}):</h3>
        {playlists.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">No playlists added yet. Add one above to get started!</p>
        ) : (
          <ScrollArea className="h-64 border rounded-md">
            <ul className="p-2 space-y-2">
              {playlists.map((playlist) => (
                <li
                  key={playlist.id}
                  className="flex items-center justify-between p-3 bg-card hover:bg-muted/50 rounded-md transition-colors"
                >
                  <div className="truncate flex-grow mr-2">
                    <p className="font-medium truncate text-sm" title={playlist.name || playlist.url}>{playlist.name || 'Unnamed Playlist'}</p>
                    <p className="text-xs text-muted-foreground truncate" title={playlist.url}>{playlist.url}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemovePlaylist(playlist.id)}
                    disabled={isLoading} // Disable remove button if global loading is true (e.g. during initial parsing)
                    aria-label={`Remove playlist ${playlist.name || playlist.url}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive hover:text-red-400" />
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Playlists are stored locally. Media content is fetched on demand up to the defined limits.
        </p>
      </CardFooter>
    </Card>
  );
}
