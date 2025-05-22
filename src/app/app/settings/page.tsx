"use client";

import { PlaylistManager } from '@/components/PlaylistManager';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Palette, ListPlus } from 'lucide-react';

export default function SettingsPage() {
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
    </div>
  );
}
