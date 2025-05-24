
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Tv2, Film, Clapperboard, Settings as SettingsIcon, PlaySquare, Menu, ChevronDown, Heart, History } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader as MobileSheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import React, { useMemo, useState, useEffect } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import type { MediaItem, MediaType } from '@/types';
import { applyParentalFilter } from '@/lib/parental-filter';
import { processGroupName } from '@/lib/group-name-utils';

interface NavItemConfig {
  value: string;
  href: string;
  label: string;
  icon: React.ElementType;
  mediaType?: MediaType;
  isStatic?: boolean;
}

const mainCategoryNavItems: NavItemConfig[] = [
  { value: 'channels', href: '/app/channels', label: 'Canais', icon: Tv2, mediaType: 'channel' },
  { value: 'movies', href: '/app/movies', label: 'Filmes', icon: Film, mediaType: 'movie' },
  { value: 'series', href: '/app/series', label: 'Séries', icon: Clapperboard, mediaType: 'series' },
];

const staticNavItems: NavItemConfig[] = [
  { value: 'recent', href: '/app/recent', label: 'Recentes', icon: History, isStatic: true },
  { value: 'favorites', href: '/app/favorites', label: 'Favoritos', icon: Heart, isStatic: true },
  { value: 'settings', href: '/app/settings', label: 'Configurações', icon: SettingsIcon, isStatic: true },
];

const ClientSideOnlyRenderer: React.FC<{ children: React.ReactNode, placeholder?: React.ReactNode }> = ({ children, placeholder }) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{placeholder}</> || null;
  }

  return <>{children}</>;
};


const NavLinks = ({ isMobile = false, closeMobileSheet }: { isMobile?: boolean, closeMobileSheet?: () => void }) => {
  const pathname = usePathname();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const { mediaItems, parentalControlEnabled } = usePlaylistStore();

  const subcategories = useMemo(() => {
    const subs: Record<MediaType, { href: string; label: string }[]> = {
      channel: [],
      movie: [],
      series: [],
    };
    if (!mediaItems || mediaItems.length === 0) return subs;

    const filteredMediaItemsForSidebar = applyParentalFilter(mediaItems, parentalControlEnabled);

    const uniqueNormalizedGroups: Record<MediaType, Set<string>> = {
      channel: new Set(),
      movie: new Set(),
      series: new Set(),
    };

    filteredMediaItemsForSidebar.forEach(item => {
      if (item.type && uniqueNormalizedGroups[item.type]) {
        const rawGroup = item.groupTitle || (item.type !== 'channel' ? item.genre : undefined) || 'Uncategorized';
        const { displayName: processedDisplayName, normalizedKey } = processGroupName(rawGroup);

        if (processedDisplayName && processedDisplayName !== 'Uncategorized' && !uniqueNormalizedGroups[item.type].has(normalizedKey)) {
          uniqueNormalizedGroups[item.type].add(normalizedKey);
          subs[item.type].push({
            label: processedDisplayName,
            href: `/app/group/${item.type}/${encodeURIComponent(processedDisplayName)}`,
          });
        }
      }
    });

    Object.values(subs).forEach(list => list.sort((a, b) => a.label.localeCompare(b.label)));
    return subs;
  }, [mediaItems, parentalControlEnabled]);

  useEffect(() => {
    const currentMainCategory = mainCategoryNavItems.find(item => item.mediaType && pathname.startsWith(`/app/group/${item.mediaType}/`));
    if (currentMainCategory && !openSubmenus[currentMainCategory.value]) {
      setOpenSubmenus(prev => ({ ...prev, [currentMainCategory.value]: true }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleSubmenu = (itemValue: string) => {
    setOpenSubmenus(prev => ({ ...prev, [itemValue]: !prev[itemValue] }));
  };

  const handleLinkClickAndCloseSheet = () => {
    if (isMobile && closeMobileSheet) {
      closeMobileSheet();
    }
  }

  return (
    <>
      {mainCategoryNavItems.map((item) => {
        const categorySubItems = item.mediaType ? subcategories[item.mediaType] : [];
        const hasSubItems = categorySubItems.length > 0;
        const isMainActive = pathname === item.href || (item.mediaType ? pathname.startsWith(`/app/group/${item.mediaType}/`) : false);

        const handleMainItemClick = () => {
          if (!hasSubItems || (openSubmenus[item.value] && pathname === item.href)) {
            handleLinkClickAndCloseSheet();
          }
        };

        return (
          <React.Fragment key={item.value}>
            <SidebarMenuItem>
               <SidebarMenuButton
                isActive={isMainActive}
                className={cn(
                  "w-full",
                  hasSubItems ? "justify-between" : "justify-start"
                )}
                onClick={() => {
                  if (hasSubItems) {
                    toggleSubmenu(item.value);
                  }
                }}
                tooltip={item.label}
                asChild={!hasSubItems}
              >
                {!hasSubItems ? (
                  <Link
                    href={item.href}
                    passHref
                    legacyBehavior={false}
                    onClick={handleMainItemClick}
                    className="flex items-center flex-grow"
                  >
                    <item.icon className="h-5 w-5 mr-2 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
                  </Link>
                ) : (
                  <>
                    <Link
                      href={item.href}
                      passHref
                      legacyBehavior={false}
                      className="flex items-center flex-grow"
                      onClick={handleMainItemClick}
                    >
                      <item.icon className="h-5 w-5 mr-2 shrink-0" />
                      <span className="group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
                    </Link>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden shrink-0",
                        openSubmenus[item.value] ? "rotate-180" : ""
                      )}
                      onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleSubmenu(item.value);
                      }}
                    />
                  </>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
            {openSubmenus[item.value] && hasSubItems && (
              <div className="pl-5 pb-1 pt-0 group-data-[collapsible=icon]:hidden">
                <SidebarMenu>
                  {categorySubItems.map(subItem => (
                    <SidebarMenuItem key={subItem.href}>
                      <Link href={subItem.href} passHref legacyBehavior={false} className="w-full">
                        <SidebarMenuButton
                          isActive={pathname === subItem.href}
                          className="w-full justify-start h-auto py-1.5 text-xs font-normal"
                          onClick={handleLinkClickAndCloseSheet}
                          tooltip={subItem.label}
                        >
                          <span className="group-data-[collapsible=icon]:hidden pl-3 truncate">{subItem.label}</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </div>
            )}
          </React.Fragment>
        );
      })}
      {staticNavItems.map((item) => (
         <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior={false} className="w-full">
            <SidebarMenuButton
              isActive={pathname === item.href}
              className="w-full justify-start"
              onClick={handleLinkClickAndCloseSheet}
              tooltip={item.label}
            >
              <item.icon className="h-5 w-5 mr-2 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </>
  );
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = React.useState(false);

  const navLinksPlaceholder = (
    <>
      {[...mainCategoryNavItems, ...staticNavItems].map((item, index) => (
        <SidebarMenuSkeleton key={`skeleton-${item.value || index}`} showIcon />
      ))}
    </>
  );


  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen bg-background">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-4 flex items-center justify-between">
             <Link href="/app/channels" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                <PlaySquare className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold">StreamVerse</h1>
              </Link>
              <Link href="/app/channels" className="items-center gap-2 hidden group-data-[collapsible=icon]:flex">
                <PlaySquare className="h-8 w-8 text-primary" />
              </Link>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <ClientSideOnlyRenderer placeholder={navLinksPlaceholder}>
              <NavLinks closeMobileSheet={() => setIsMobileSheetOpen(false)} />
            </ClientSideOnlyRenderer>
          </SidebarContent>
          <SidebarFooter className="p-4 mt-auto group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </SidebarFooter>
           <SidebarFooter className="p-2 mt-auto hidden group-data-[collapsible=icon]:flex items-center justify-center">
            <ThemeToggle />
          </SidebarFooter>
        </Sidebar>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6 md:hidden">
            <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col p-0">
                <MobileSheetHeader className="p-4 border-b">
                   <Link href="/app/channels" className="flex items-center gap-2" onClick={() => setIsMobileSheetOpen(false)}>
                      <PlaySquare className="h-8 w-8 text-primary" />
                      <SheetTitle className="text-xl font-bold">StreamVerse</SheetTitle>
                    </Link>
                </MobileSheetHeader>
                <nav className="grid gap-1 text-lg font-medium p-2 flex-grow overflow-y-auto">
                  <ClientSideOnlyRenderer placeholder={navLinksPlaceholder}>
                    <NavLinks isMobile closeMobileSheet={() => setIsMobileSheetOpen(false)} />
                  </ClientSideOnlyRenderer>
                </nav>
                 <div className="mt-auto p-4 border-t">
                    <ThemeToggle />
                  </div>
              </SheetContent>
            </Sheet>
             <Link href="/app/channels" className="flex items-center gap-2">
                <PlaySquare className="h-7 w-7 text-primary" />
                <h1 className="text-xl font-semibold">StreamVerse</h1>
              </Link>
          </header>
          <main className="flex-1 overflow-y-auto p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
