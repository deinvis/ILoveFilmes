
"use client";

import React, { useState, useEffect } from 'react';
import { PlaylistManager } from '@/components/PlaylistManager';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Palette, ListPlus, CalendarDays, Save, Home, Heart, History, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';
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
import { usePlaylistStore } from '@/store/playlistStore';
import { useToast } from "@/hooks/use-toast";
import type { StartPagePath } from '@/types';

const startPageOptions: { value: StartPagePath, label: string }[] = [
  { value: '/app/channels', label: 'Canais' },
  { value: '/app/movies', label: 'Filmes' },
  { value: '/app/series', label: 'Séries' },
  { value: '/app/favorites', label: 'Favoritos' },
  { value: '/app/recent', label: 'Recentes' },
];

export default function SettingsPage() {
  const { 
    epgUrl, 
    setEpgUrl, 
    epgLoading, 
    epgError,
    preferredStartPage,
    setPreferredStartPage,
    parentalControlEnabled,
    setParentalControlEnabled,
    resetAppState
  } = usePlaylistStore();
  
  const [currentEpgUrl, setCurrentEpgUrl] = useState(epgUrl || '');
  const { toast } = useToast();

  useEffect(() => {
    setCurrentEpgUrl(epgUrl || '');
  }, [epgUrl]);

  const handleSaveEpgUrl = async () => {
    if (!currentEpgUrl.trim()) {
      await setEpgUrl(null);
       toast({
        title: "EPG URL Removido",
        description: "A URL do EPG foi removida.",
      });
      return;
    }
    try {
      new URL(currentEpgUrl); 
      await setEpgUrl(currentEpgUrl);
      toast({
        title: "EPG URL Salvo",
        description: "Os dados do EPG serão buscados e atualizados.",
      });
    } catch (_) {
      toast({
        title: "URL do EPG Inválida",
        description: "Por favor, insira um formato de URL válido para o EPG.",
        variant: "destructive",
      });
    }
  };

  const handleStartPageChange = (value: string) => {
    setPreferredStartPage(value as StartPagePath);
    toast({
      title: "Página Inicial Atualizada",
      description: `Seu aplicativo agora abrirá em ${startPageOptions.find(opt => opt.value === value)?.label || 'página selecionada'}.`,
    });
  };

  const handleParentalControlToggle = (enabled: boolean) => {
    setParentalControlEnabled(enabled);
    toast({
      title: "Controle Parental Atualizado",
      description: `Filtro de conteúdo adulto ${enabled ? 'ativado' : 'desativado'}. As listas serão atualizadas.`,
    });
  };

  const handleResetData = () => {
    resetAppState();
    toast({
      title: "Dados do Aplicativo Redefinidos",
      description: "Todas as suas configurações, playlists e histórico foram limpos. Pode ser necessário recarregar a página.",
    });
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">Configurações</h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><Palette className="mr-3 h-6 w-6 text-primary" /> Configurações de Tema</CardTitle>
          <CardDescription>Personalize a aparência do StreamVerse.</CardDescription>
        </CardHeader>
        <CardContent className="w-full sm:w-1/2 lg:w-1/3">
          <ThemeToggle />
        </CardContent>
      </Card>
      
      <Separator />

       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><Home className="mr-3 h-6 w-6 text-primary" /> Preferências de Inicialização</CardTitle>
          <CardDescription>Escolha qual página o StreamVerse abrirá por padrão.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={preferredStartPage}
            onValueChange={handleStartPageChange}
            className="space-y-2"
          >
            {startPageOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value}>{option.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><ShieldCheck className="mr-3 h-6 w-6 text-primary" /> Controle Parental</CardTitle>
          <CardDescription>Gerencie a visibilidade de conteúdo adulto.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Switch
              id="parental-control-switch"
              checked={parentalControlEnabled}
              onCheckedChange={handleParentalControlToggle}
              aria-label="Ativar ou desativar filtro de conteúdo adulto"
            />
            <Label htmlFor="parental-control-switch">
              {parentalControlEnabled ? 'Filtro de Conteúdo Adulto Ativado' : 'Filtro de Conteúdo Adulto Desativado'}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Quando ativado, conteúdo com "XXX" ou "ADULTOS" no título ou grupo será ocultado.
          </p>
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-lg">
         <CardHeader>
          <CardTitle className="flex items-center text-xl"><ListPlus className="mr-3 h-6 w-6 text-primary" /> Configurações de Playlist</CardTitle>
          <CardDescription>Gerencie suas fontes de playlist M3U ou Xtream Codes.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlaylistManager />
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><CalendarDays className="mr-3 h-6 w-6 text-primary" /> Configurações de EPG (Guia de Programação)</CardTitle>
          <CardDescription>Defina sua URL de EPG XMLTV para obter informações de programação para seus canais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2 items-center">
            <Input
              type="url"
              placeholder="Insira a URL do EPG XMLTV (ex: https://example.com/epg.xml)"
              value={currentEpgUrl}
              onChange={(e) => setCurrentEpgUrl(e.target.value)}
              className="flex-grow"
              aria-label="EPG URL"
            />
            <Button onClick={handleSaveEpgUrl} disabled={epgLoading}>
              <Save className="mr-2 h-4 w-4" />
              {epgLoading ? 'Salvando...' : 'Salvar EPG'}
            </Button>
          </div>
          {epgError && (
            <p className="text-sm text-destructive">{epgError}</p>
          )}
          {epgLoading && (
            <p className="text-sm text-muted-foreground">Buscando e processando dados do EPG...</p>
          )}
          {epgUrl && !epgLoading && !epgError && (
             <p className="text-sm text-green-600">Dados do EPG carregados com sucesso de: {epgUrl}</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-lg border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center text-xl text-destructive"><Trash2 className="mr-3 h-6 w-6" /> Gerenciamento de Dados</CardTitle>
          <CardDescription>Ações perigosas para redefinir os dados do aplicativo.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Limpar Todos os Dados do Aplicativo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é irreversível e removerá todas as suas playlists, EPG URL,
                  favoritos, histórico de reprodução e outras configurações.
                  Seus dados serão completamente apagados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetData} className="bg-destructive hover:bg-destructive/90">
                  Sim, limpar tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="text-xs text-muted-foreground mt-3">
            Isso removerá todos os dados armazenados localmente pelo StreamVerse.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}

