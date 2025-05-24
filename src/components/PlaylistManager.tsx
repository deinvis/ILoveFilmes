
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, AlertCircle, ListVideo, CalendarClock, Pencil, UploadCloud } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import type { PlaylistType, PlaylistItem } from '@/types';
import { cn } from "@/lib/utils";

export function PlaylistManager() {
  const [playlistInputType, setPlaylistInputType] = useState<PlaylistType>('m3u');
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newXcDns, setNewXcDns] = useState('');
  const [newXcUsername, setNewXcUsername] = useState('');
  const [newXcPassword, setNewXcPassword] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { playlists, addPlaylist, removePlaylist, isLoading, error, fetchAndParsePlaylists, updatePlaylist, addPlaylistFromFileContent } = usePlaylistStore();
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<PlaylistItem | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [editPlaylistUrl, setEditPlaylistUrl] = useState('');
  const [editXcDns, setEditXcDns] = useState('');
  const [editXcUsername, setEditXcUsername] = useState('');
  const [editXcPassword, setEditXcPassword] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);


  useEffect(() => {
    if (typeof window !== 'undefined' && playlists.length === 0 && !isLoading) {
      fetchAndParsePlaylists();
    }
  }, [fetchAndParsePlaylists, isLoading, playlists.length]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setNewPlaylistUrl(''); 
    }
  };

  const handleAddPlaylist = async () => {
    let playlistNameError = false;
    
    if (playlistInputType === 'm3u') {
      if (selectedFile) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const fileContent = e.target?.result as string;
          if (fileContent) {
            await addPlaylistFromFileContent(fileContent, newPlaylistName.trim() || selectedFile.name);
             const currentError = usePlaylistStore.getState().error;
             if (currentError && (currentError.includes(newPlaylistName.trim() || selectedFile.name) || currentError.includes("Falha ao processar playlist de arquivo"))) {
                toast({ title: "Erro ao adicionar playlist do arquivo", description: currentError, variant: "destructive" });
             } else if (!currentError) { 
                toast({ title: "Sucesso", description: `Playlist do arquivo "${newPlaylistName.trim() || selectedFile.name}" agendada para adição.` });
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                setNewPlaylistName('');
             }
          } else {
            toast({ title: "Erro", description: "Não foi possível ler o conteúdo do arquivo.", variant: "destructive" });
          }
        };
        reader.onerror = () => {
          toast({ title: "Erro", description: "Falha ao ler o arquivo.", variant: "destructive" });
        };
        reader.readAsText(selectedFile);
        return; 
      } else if (!newPlaylistUrl.trim()) {
        toast({ title: "Erro", description: "URL da playlist ou arquivo M3U deve ser fornecido.", variant: "destructive" });
        return;
      }
      try { new URL(newPlaylistUrl); } catch (_) {
        toast({ title: "Erro", description: "Formato de URL inválido.", variant: "destructive" });
        return;
      }
      await addPlaylist({ type: 'm3u', url: newPlaylistUrl, name: newPlaylistName.trim() || undefined, source: 'url' });
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
        source: 'url' 
      });
    }
    
    const currentError = usePlaylistStore.getState().error; 
    const lastAddedPlaylistName = newPlaylistName.trim() || (playlistInputType === 'm3u' ? newPlaylistUrl : newXcDns);

    if (currentError && (currentError.includes(newPlaylistUrl) || currentError.includes(newXcDns) || currentError.includes(lastAddedPlaylistName))) {
       playlistNameError = true; 
       toast({ title: "Erro ao adicionar playlist", description: currentError, variant: "destructive" });
    }
    
    if (!playlistNameError && !selectedFile) { 
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
    setIsEditDialogOpen(false); 
    setIsDeleteConfirmOpen(false); 
    setEditingPlaylist(null);
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

    if (editingPlaylist.type === 'm3u' && editingPlaylist.source === 'url') {
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
    // For file-based playlists, only name is updated. No specific validation here beyond the name itself.

    if (validationError) return;

    await updatePlaylist(editingPlaylist.id, updates);
    const currentError = usePlaylistStore.getState().error; 
    if (currentError && (currentError.includes(editingPlaylist.id) || (updates.url && currentError.includes(updates.url)) || (updates.xcDns && currentError.includes(updates.xcDns)))) {
        toast({ title: "Erro ao atualizar playlist", description: currentError, variant: "destructive" });
    } else if (!currentError) { 
        toast({ title: "Playlist Atualizada", description: `Playlist "${editPlaylistName.trim() || editingPlaylist.name || editingPlaylist.id}" atualizada com sucesso.` });
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
          <CardDescription>Adicione ou remova suas fontes de playlist (URL M3U, Xtream Codes ou arquivo M3U).</CardDescription>
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
              <RadioGroup value={playlistInputType} onValueChange={(value) => { setPlaylistInputType(value as PlaylistType); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="m3u" id="type-m3u" />
                  <Label htmlFor="type-m3u">M3U (URL ou Arquivo)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="xc" id="type-xc" />
                  <Label htmlFor="type-xc">Xtream Codes</Label>
                </div>
              </RadioGroup>
            </div>

            {playlistInputType === 'm3u' && (
              <div className="space-y-3 p-4 border rounded-md bg-muted/20">
                 <h4 className="text-md font-semibold mb-2">Detalhes M3U</h4>
                <div>
                    <Label htmlFor="playlist-url" className="mb-1.5 block text-sm font-medium">URL da Playlist M3U</Label>
                    <Input
                    id="playlist-url"
                    type="url"
                    placeholder="Ex: https://example.com/playlist.m3u"
                    value={newPlaylistUrl}
                    onChange={(e) => { setNewPlaylistUrl(e.target.value); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    aria-label="Nova URL de playlist M3U"
                    disabled={!!selectedFile}
                    />
                </div>
                <div className="text-center my-2 text-sm text-muted-foreground">OU</div>
                <div>
                    <Label htmlFor="playlist-file" className="mb-1.5 block text-sm font-medium">Carregar Arquivo M3U (.m3u, .m3u8)</Label>
                    <Input
                    id="playlist-file"
                    type="file"
                    ref={fileInputRef}
                    accept=".m3u,.m3u8"
                    onChange={handleFileChange}
                    aria-label="Carregar arquivo M3U"
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    {selectedFile && <p className="text-xs text-muted-foreground mt-1">Arquivo selecionado: {selectedFile.name}</p>}
                </div>
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
                placeholder={playlistInputType === 'xc' ? (newXcDns || 'Minha Lista XC') : (selectedFile ? selectedFile.name : (newPlaylistUrl || 'Minha Lista M3U'))}
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
                    <div className="truncate flex-grow mr-2 min-w-0"> 
                      <p className="font-medium truncate text-sm" title={playlist.name || (playlist.type === 'm3u' ? (playlist.url || 'Arquivo M3U') : playlist.xcDns)}>
                        {playlist.name || (playlist.type === 'm3u' ? (playlist.url ? 'Playlist M3U Sem Nome' : `Arquivo: ${playlist.url || 'Desconhecido'}`) : 'Playlist XC Sem Nome')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate" title={playlist.type === 'm3u' ? (playlist.url || `Fonte: ${playlist.source}`) : playlist.xcDns}>
                        {playlist.type === 'm3u' ? (playlist.url || `Fonte: ${playlist.source}`) : `XC: ${playlist.xcDns}`}
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
                        title={`Editar playlist ${playlist.name || '...'}`}
                        className="mr-1"
                      >
                        <Pencil className="h-4 w-4 text-blue-500 hover:text-blue-400" />
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
            Playlists são armazenadas localmente. Para Xtream Codes, a senha é armazenada. Conteúdo de arquivos M3U é processado no momento do upload.
          </p>
        </CardFooter>
      </Card>

      {editingPlaylist && (
        <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => {
          setIsEditDialogOpen(isOpen);
          if (!isOpen) setEditingPlaylist(null); 
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Playlist: {editingPlaylist.name || (editingPlaylist.type === 'm3u' ? (editingPlaylist.url || `Arquivo ${editingPlaylist.id.substring(0,6)}...`) : editingPlaylist.xcDns)}</DialogTitle>
              <DialogDescription>
                Modifique os detalhes da sua playlist {editingPlaylist.type === 'm3u' ? (editingPlaylist.source === 'file' ? 'baseada em arquivo (apenas nome)' : 'M3U') : 'Xtream Codes'}. O tipo da playlist e a fonte (URL/Arquivo) não podem ser alterados.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-playlist-name">Nome da Playlist*</Label>
                <Input
                  id="edit-playlist-name"
                  value={editPlaylistName}
                  onChange={(e) => setEditPlaylistName(e.target.value)}
                  placeholder={editingPlaylist.type === 'xc' ? (editingPlaylist.xcDns || 'Minha Lista XC') : (editingPlaylist.url || `Arquivo ${editingPlaylist.name || 'M3U'}`)}
                />
              </div>

              {editingPlaylist.type === 'm3u' && editingPlaylist.source === 'url' && (
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
               {editingPlaylist.type === 'm3u' && editingPlaylist.source === 'file' && (
                <p className="text-sm text-muted-foreground">
                    O conteúdo de playlists baseadas em arquivo não pode ser alterado aqui. Para atualizar, remova esta lista e adicione o novo arquivo.
                </p>
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
            <DialogFooter className="sm:justify-between">
              <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="mt-2 sm:mt-0">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Apagar Playlist
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Isso removerá permanentemente a playlist
                       "{editingPlaylist.name || (editingPlaylist.type === 'm3u' ? (editingPlaylist.url || 'Playlist M3U') : editingPlaylist.xcDns)}"
                       e todos os seus itens associados do StreamVerse.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => editingPlaylist && handleRemovePlaylist(editingPlaylist.id)}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Sim, apagar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <div className="flex space-x-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button 
                  onClick={handleSaveChanges} 
                  disabled={
                    isLoading ||
                    !editPlaylistName.trim() || // Always require a name
                    (editingPlaylist.type === 'm3u' && editingPlaylist.source === 'file' && editPlaylistName.trim() === editingPlaylist.name) || // For file, disable if name is same
                    (editingPlaylist.type === 'm3u' && editingPlaylist.source === 'url' && (!editPlaylistUrl.trim() || (editPlaylistName.trim() === editingPlaylist.name && editPlaylistUrl.trim() === editingPlaylist.url))) || // For M3U URL, disable if URL empty or nothing changed
                    (editingPlaylist.type === 'xc' && (!editXcDns.trim() || !editXcUsername.trim() || !editXcPassword.trim() || (editPlaylistName.trim() === editingPlaylist.name && editXcDns.trim() === editingPlaylist.xcDns && editXcUsername.trim() === editingPlaylist.xcUsername && editXcPassword.trim() === editingPlaylist.xcPassword))) // For XC, disable if required fields empty or nothing changed
                  }
                >
                  {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

