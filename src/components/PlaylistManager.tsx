
"use client";

import React, { useState, useEffect } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, AlertCircle, ListVideo, CalendarClock, Pencil } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { format, parseISO } from 'date-fns';
import type { PlaylistType, PlaylistItem } from '@/types';

export function PlaylistManager() {
  const [playlistInputType, setPlaylistInputType] = useState<PlaylistType>('m3u');
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newXcDns, setNewXcDns] = useState('');
  const [newXcUsername, setNewXcUsername] = useState('');
  const [newXcPassword, setNewXcPassword] = useState('');

  const { playlists, addPlaylist, removePlaylist, isLoading, error, fetchAndParsePlaylists, updatePlaylist } = usePlaylistStore();
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<PlaylistItem | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [editPlaylistUrl, setEditPlaylistUrl] = useState('');
  const [editXcDns, setEditXcDns] = useState('');
  const [editXcUsername, setEditXcUsername] = useState('');
  const [editXcPassword, setEditXcPassword] = useState('');


  useEffect(() => {
    if (playlists.length === 0 && !isLoading) {
      fetchAndParsePlaylists();
    }
  }, [fetchAndParsePlaylists, isLoading, playlists.length]);


  const handleAddPlaylist = async () => {
    let playlistNameError = false;
    
    if (playlistInputType === 'm3u') {
      if (!newPlaylistUrl.trim()) {
        toast({ title: "Erro", description: "URL da playlist não pode ser vazia.", variant: "destructive" });
        return;
      }
      try { new URL(newPlaylistUrl); } catch (_) {
        toast({ title: "Erro", description: "Formato de URL inválido.", variant: "destructive" });
        return;
      }
      await addPlaylist({ type: 'm3u', url: newPlaylistUrl, name: newPlaylistName.trim() || undefined });
    } else if (playlistInputType === 'xc') {
      if (!newXcDns.trim() || !newXcUsername.trim() || !newXcPassword.trim()) {
        toast({ title: "Erro", description: "DNS, Nome de Usuário e Senha são obrigatórios para Xtream Codes.", variant: "destructive" });
        return;
      }
      try {
        const parsedDns = new URL(newXcDns);
        if(!['http:', 'https:',].includes(parsedDns.protocol)){
          toast({ title: "Erro", description: "DNS inválido. Deve começar com http:// ou https://", variant: "destructive" });
          return;
        }
      } catch (_) {
        toast({ title: "Erro", description: "Formato de DNS inválido. Ex: http://example.com:8080", variant: "destructive" });
        return;
      }
      await addPlaylist({
        type: 'xc',
        xcDns: newXcDns,
        xcUsername: newXcUsername,
        xcPassword: newXcPassword,
        name: newPlaylistName.trim() || newXcDns,
      });
    }
    
    const currentError = usePlaylistStore.getState().error; 
    const lastAddedPlaylistName = newPlaylistName.trim() || (playlistInputType === 'm3u' ? newPlaylistUrl : newXcDns);

    if (currentError && (currentError.includes(newPlaylistUrl) || currentError.includes(newXcDns))) {
       playlistNameError = true; 
       toast({ title: "Erro ao adicionar playlist", description: currentError, variant: "destructive" });
    }
    
    if (!playlistNameError) {
      toast({ title: "Sucesso", description: `Playlist ${lastAddedPlaylistName} agendada para adição.` });
      setNewPlaylistUrl('');
      setNewPlaylistName('');
      setNewXcDns('');
      setNewXcUsername('');
      setNewXcPassword('');
    }
  };
  
  const handleRemovePlaylist = (id: string) => {
    removePlaylist(id);
    toast({ title: "Playlist Removida", description: `Playlist foi removida e os itens de mídia serão atualizados.` });
  };

  const formatExpiryDate = (isoDateString?: string) => {
    if (!isoDateString) return 'N/A';
    try { return format(parseISO(isoDateString), "dd/MM/yyyy 'às' HH:mm"); } catch (e) { return 'Data inválida'; }
  };

  const handleEditClick = (playlist: PlaylistItem) => {
    setEditingPlaylist(playlist);
    setEditPlaylistName(playlist.name || '');
    if (playlist.type === 'm3u') {
      setEditPlaylistUrl(playlist.url || '');
      setEditXcDns('');
      setEditXcUsername('');
      setEditXcPassword('');
    } else if (playlist.type === 'xc') {
      setEditPlaylistUrl('');
      setEditXcDns(playlist.xcDns || '');
      setEditXcUsername(playlist.xcUsername || '');
      setEditXcPassword(playlist.xcPassword || '');
    }
    setIsEditDialogOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!editingPlaylist) return;

    const updates: Partial<PlaylistItem> = { name: editPlaylistName.trim() || undefined };
    let validationError = false;

    if (editingPlaylist.type === 'm3u') {
      if (!editPlaylistUrl.trim()) {
        toast({ title: "Erro na Edição", description: "URL da playlist M3U não pode ser vazia.", variant: "destructive" });
        validationError = true;
      } else {
        try { new URL(editPlaylistUrl); updates.url = editPlaylistUrl; } catch (_) {
          toast({ title: "Erro na Edição", description: "Formato de URL M3U inválido.", variant: "destructive" });
          validationError = true;
        }
      }
    } else if (editingPlaylist.type === 'xc') {
      if (!editXcDns.trim() || !editXcUsername.trim() || !editXcPassword.trim()) {
        toast({ title: "Erro na Edição", description: "DNS, Nome de Usuário e Senha são obrigatórios para Xtream Codes.", variant: "destructive" });
        validationError = true;
      } else {
        try {
          const parsedDns = new URL(editXcDns);
          if(!['http:', 'https:',].includes(parsedDns.protocol)){
            toast({ title: "Erro na Edição", description: "DNS inválido. Deve começar com http:// ou https://", variant: "destructive" });
            validationError = true;
          } else {
            updates.xcDns = editXcDns;
            updates.xcUsername = editXcUsername;
            updates.xcPassword = editXcPassword;
          }
        } catch (_) {
          toast({ title: "Erro na Edição", description: "Formato de DNS inválido. Ex: http://example.com:8080", variant: "destructive" });
          validationError = true;
        }
      }
    }

    if (validationError) return;

    await updatePlaylist(editingPlaylist.id, updates);
    const currentError = usePlaylistStore.getState().error;
    if (currentError && (currentError.includes(editingPlaylist.id) || (updates.url && currentError.includes(updates.url)) || (updates.xcDns && currentError.includes(updates.xcDns)))) {
        toast({ title: "Erro ao atualizar playlist", description: currentError, variant: "destructive" });
    } else {
        toast({ title: "Playlist Atualizada", description: `Playlist "${editingPlaylist.name || editingPlaylist.id}" atualizada com sucesso.` });
        setIsEditDialogOpen(false);
        setEditingPlaylist(null);
    }
  };


  return (
    <>
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center">
            <ListVideo className="mr-3 h-7 w-7 text-primary" /> Gerenciar Playlists
          </CardTitle>
          <CardDescription>Adicione ou remova suas fontes de playlist (URL M3U ou Xtream Codes).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && !isLoading && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro Geral</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block text-sm font-medium">Tipo de Playlist</Label>
              <RadioGroup value={playlistInputType} onValueChange={(value) => setPlaylistInputType(value as PlaylistType)} className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="m3u" id="type-m3u" />
                  <Label htmlFor="type-m3u">URL M3U</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="xc" id="type-xc" />
                  <Label htmlFor="type-xc">Xtream Codes</Label>
                </div>
              </RadioGroup>
            </div>

            {playlistInputType === 'm3u' && (
              <div>
                <Label htmlFor="playlist-url" className="mb-1.5 block text-sm font-medium">URL da Playlist M3U*</Label>
                <Input
                  id="playlist-url"
                  type="url"
                  placeholder="Ex: https://example.com/playlist.m3u"
                  value={newPlaylistUrl}
                  onChange={(e) => setNewPlaylistUrl(e.target.value)}
                  aria-label="Nova URL de playlist M3U"
                />
              </div>
            )}

            {playlistInputType === 'xc' && (
              <div className="space-y-3 p-4 border rounded-md bg-muted/20">
                <h4 className="text-md font-semibold mb-2">Detalhes Xtream Codes</h4>
                <div>
                  <Label htmlFor="xc-dns" className="mb-1.5 block text-sm font-medium">DNS do Servidor* (com http/https)</Label>
                  <Input
                    id="xc-dns"
                    type="url"
                    placeholder="Ex: http://myportal.com:8080"
                    value={newXcDns}
                    onChange={(e) => setNewXcDns(e.target.value)}
                    aria-label="DNS do servidor Xtream Codes"
                  />
                </div>
                <div>
                  <Label htmlFor="xc-username" className="mb-1.5 block text-sm font-medium">Nome de Usuário*</Label>
                  <Input
                    id="xc-username"
                    type="text"
                    placeholder="Seu usuário"
                    value={newXcUsername}
                    onChange={(e) => setNewXcUsername(e.target.value)}
                    aria-label="Nome de usuário Xtream Codes"
                  />
                </div>
                <div>
                  <Label htmlFor="xc-password" className="mb-1.5 block text-sm font-medium">Senha*</Label>
                  <Input
                    id="xc-password"
                    type="password"
                    placeholder="Sua senha"
                    value={newXcPassword}
                    onChange={(e) => setNewXcPassword(e.target.value)}
                    aria-label="Senha Xtream Codes"
                  />
                </div>
              </div>
            )}
            
            <div>
              <Label htmlFor="playlist-name" className="mb-1.5 block text-sm font-medium">Nome da Playlist (Opcional)</Label>
              <Input
                id="playlist-name"
                type="text"
                placeholder={playlistInputType === 'xc' ? (newXcDns || 'Minha Lista XC') : 'Minha Lista M3U'}
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                aria-label="Nome opcional para a playlist"
              />
            </div>
            <Button onClick={handleAddPlaylist} disabled={isLoading} aria-label="Adicionar playlist" className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" />
              {isLoading ? 'Adicionando...' : 'Adicionar Playlist'}
            </Button>
          </div>
          
          {isLoading && playlists.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Carregando playlists pela primeira vez...</p>}

          <h3 className="text-lg font-semibold mt-6 mb-2">Suas Playlists ({playlists.length}):</h3>
          {playlists.length === 0 && !isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma playlist adicionada ainda. Adicione uma acima para começar!</p>
          ) : (
            <ScrollArea className="h-64 border rounded-md">
              <ul className="p-2 space-y-2">
                {playlists.map((playlist) => (
                  <li
                    key={playlist.id}
                    className="flex items-center justify-between p-3 bg-card hover:bg-muted/50 rounded-md transition-colors"
                  >
                    <div className="truncate flex-grow mr-2">
                      <p className="font-medium truncate text-sm" title={playlist.name || (playlist.type === 'm3u' ? playlist.url : playlist.xcDns)}>
                        {playlist.name || (playlist.type === 'm3u' ? 'Playlist M3U Sem Nome' : 'Playlist XC Sem Nome')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate" title={playlist.type === 'm3u' ? playlist.url : playlist.xcDns}>
                        {playlist.type === 'm3u' ? playlist.url : `XC: ${playlist.xcDns}`}
                      </p>
                      {playlist.expiryDate && (
                        <p className="text-xs text-muted-foreground/80 truncate mt-0.5 flex items-center" title={`Expira em: ${formatExpiryDate(playlist.expiryDate)}`}>
                          <CalendarClock className="mr-1 h-3 w-3" /> Expira: {formatExpiryDate(playlist.expiryDate)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(playlist)}
                        disabled={isLoading}
                        aria-label={`Editar playlist ${playlist.name || (playlist.type === 'm3u' ? playlist.url : playlist.xcDns)}`}
                        className="mr-1"
                      >
                        <Pencil className="h-4 w-4 text-blue-500 hover:text-blue-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemovePlaylist(playlist.id)}
                        disabled={isLoading}
                        aria-label={`Remover playlist ${playlist.name || (playlist.type === 'm3u' ? playlist.url : playlist.xcDns)}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive hover:text-red-400" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Playlists são armazenadas localmente. Conteúdo de mídia é buscado sob demanda. Para Xtream Codes, a senha é armazenada.
          </p>
        </CardFooter>
      </Card>

      {editingPlaylist && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Playlist: {editingPlaylist.name || (editingPlaylist.type === 'm3u' ? editingPlaylist.url : editingPlaylist.xcDns)}</DialogTitle>
              <DialogDescription>
                Modifique os detalhes da sua playlist {editingPlaylist.type === 'm3u' ? 'M3U' : 'Xtream Codes'}. O tipo da playlist não pode ser alterado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-playlist-name">Nome da Playlist (Opcional)</Label>
                <Input
                  id="edit-playlist-name"
                  value={editPlaylistName}
                  onChange={(e) => setEditPlaylistName(e.target.value)}
                  placeholder={editingPlaylist.type === 'xc' ? (editingPlaylist.xcDns || 'Minha Lista XC') : 'Minha Lista M3U'}
                />
              </div>

              {editingPlaylist.type === 'm3u' && (
                <div>
                  <Label htmlFor="edit-playlist-url">URL da Playlist M3U*</Label>
                  <Input
                    id="edit-playlist-url"
                    type="url"
                    value={editPlaylistUrl}
                    onChange={(e) => setEditPlaylistUrl(e.target.value)}
                    placeholder="Ex: https://example.com/playlist.m3u"
                  />
                </div>
              )}

              {editingPlaylist.type === 'xc' && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edit-xc-dns">DNS do Servidor* (com http/https)</Label>
                    <Input
                      id="edit-xc-dns"
                      type="url"
                      value={editXcDns}
                      onChange={(e) => setEditXcDns(e.target.value)}
                      placeholder="Ex: http://myportal.com:8080"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-xc-username">Nome de Usuário*</Label>
                    <Input
                      id="edit-xc-username"
                      type="text"
                      value={editXcUsername}
                      onChange={(e) => setEditXcUsername(e.target.value)}
                      placeholder="Seu usuário"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-xc-password">Senha*</Label>
                    <Input
                      id="edit-xc-password"
                      type="password"
                      value={editXcPassword}
                      onChange={(e) => setEditXcPassword(e.target.value)}
                      placeholder="Sua senha"
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleSaveChanges} disabled={isLoading}>
                {isLoading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

    