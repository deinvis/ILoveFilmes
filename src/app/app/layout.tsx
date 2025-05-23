
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
  SidebarInset,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader as MobileSheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'; 
import React, { useMemo, useState, useEffect } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import type { MediaType } from '@/types';

interface NavItemConfig {
  value: string; // For state management, e.g., 'channels'
  href: string;
  label: string;
  icon: React.ElementType;
  mediaType?: MediaType;
  isStatic?: boolean; // To differentiate static items like Settings, Favorites
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileSheetOpen, setIsMobileSheetOpen] = React.useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const { mediaItems } = usePlaylistStore();

  const subcategories = useMemo(() => {
    const subs: Record<MediaType, { href: string; label: string }[]> = {
      channel: [],
      movie: [],
      series: [],
    };
    if (!mediaItems || mediaItems.length === 0) return subs;

    const uniqueGroups: Record<string, Set<string>> = { 
      channel: new Set(),
      movie: new Set(),
      series: new Set(),
    };

    mediaItems.forEach(item => {
      if (item.type && uniqueGroups[item.type]) {
        const group = item.groupTitle || (item.type !== 'channel' ? item.genre : undefined) || 'Uncategorized';
        if (group && !uniqueGroups[item.type].has(group)) { // Ensure group is not undefined
          uniqueGroups[item.type].add(group);
          subs[item.type].push({
            label: group,
            href: `/app/group/${item.type}/${encodeURIComponent(group)}`,
          });
        }
      }
    });

    Object.values(subs).forEach(list => list.sort((a, b) => a.label.localeCompare(b.label)));
    return subs;
  }, [mediaItems]);
  
  useEffect(() => {
    // Automatically open submenu if a sub-item is active on initial load or navigation
    const currentMainCategory = mainCategoryNavItems.find(item => item.mediaType && pathname.startsWith(`/app/group/${item.mediaType}/`));
    if (currentMainCategory && !openSubmenus[currentMainCategory.value]) {
      setOpenSubmenus(prev => ({ ...prev, [currentMainCategory.value]: true }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // Rerun when pathname changes

  const toggleSubmenu = (itemValue: string) => {
    setOpenSubmenus(prev => ({ ...prev, [itemValue]: !prev[itemValue] }));
  };

  const NavLinks = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {mainCategoryNavItems.map((item) => {
        const categorySubItems = item.mediaType ? subcategories[item.mediaType] : [];
        const hasSubItems = categorySubItems.length > 0;
        const isMainActive = pathname === item.href || (item.mediaType ? pathname.startsWith(`/app/group/${item.mediaType}/`) : false);
        
        const handleLinkClick = () => {
          if (isMobile) {
            if (!hasSubItems || (openSubmenus[item.value] && pathname === item.href)) {
              setIsMobileSheetOpen(false);
            }
          }
        };

        return (
          <React.Fragment key={item.value}>
            <SidebarMenuItem>
               <SidebarMenuButton
                isActive={isMainActive}
                className="w-full justify-between"
                onClick={() => {
                  if (hasSubItems) {
                    toggleSubmenu(item.value);
                  }
                  // For mobile: close sheet ONLY if it's a direct link (no subitems)
                  // OR if it's a main link AND subitems are already open.
                  // This prevents closing when just trying to expand.
                  if (isMobile && (!hasSubItems || (hasSubItems && openSubmenus[item.value]))) {
                     // setIsMobileSheetOpen(false); // This logic is a bit complex, handleLinkClick might be better
                  }
                }}
                tooltip={item.label}
                asChild={!hasSubItems} // Button becomes a Slot if no sub-items, so Link is the actual button
              >
                {!hasSubItems ? (
                  <Link
                    href={item.href}
                    passHref // Important for asChild components to pass href correctly
                    legacyBehavior // Needed when Link is child of asChild component
                    onClick={handleLinkClick} 
                  >
                    <a className="flex items-center gap-2 flex-grow">
                      <item.icon className="h-5 w-5" />
                      <span className="group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
                    </a>
                  </Link>
                ) : (
                  <>
                    <Link
                      href={item.href}
                      // passHref // No passHref if Link is not the direct child of an asChild component or is not legacy
                      legacyBehavior={false} // Default for Next 13+ when children are not just an <a> tag
                      className="flex items-center gap-2 flex-grow" // Apply flex styles directly
                      onClick={handleLinkClick} 
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
                    </Link>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden shrink-0", 
                        openSubmenus[item.value] ? "rotate-180" : ""
                      )}
                      // Make only the chevron toggle the submenu, not navigate
                      onClick={(e) => { 
                          e.stopPropagation(); // Prevent Link navigation
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
                      <Link href={subItem.href} passHref legacyBehavior>
                        <SidebarMenuButton
                          isActive={pathname === subItem.href}
                          className="w-full justify-start h-auto py-1.5 text-xs font-normal" // Smaller text for sub-items
                          onClick={() => {
                            if (isMobile) setIsMobileSheetOpen(false);
                          }}
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
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              isActive={pathname === item.href}
              className="w-full justify-start"
              onClick={() => {
                if (isMobile) setIsMobileSheetOpen(false);
              }}
              tooltip={item.label}
            >
              <item.icon className="h-5 w-5" />
              <span className="group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
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
              {/* Icon-only link for collapsed sidebar */}
              <Link href="/app/channels" className="items-center gap-2 hidden group-data-[collapsible=icon]:flex">
                <PlaySquare className="h-8 w-8 text-primary" />
              </Link>
          </SidebarHeader>
          <SidebarContent className="flex-grow p-2">
            <NavLinks />
          </SidebarContent>
          <SidebarFooter className="p-4 mt-auto group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </SidebarFooter>
           <SidebarFooter className="p-2 mt-auto hidden group-data-[collapsible=icon]:flex items-center justify-center">
            <ThemeToggle />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex-1 flex flex-col overflow-hidden">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6 md:hidden">
            <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col p-0">
                <MobileSheetHeader className="p-4 border-b"> {/* Changed SheetHeader to MobileSheetHeader to avoid conflict */}
                   <Link href="/app/channels" className="flex items-center gap-2" onClick={() => setIsMobileSheetOpen(false)}>
                      <PlaySquare className="h-8 w-8 text-primary" />
                      <SheetTitle className="text-xl font-bold">StreamVerse</SheetTitle>
                    </Link>
                </MobileSheetHeader>
                <nav className="grid gap-1 text-lg font-medium p-2">
                  <NavLinks isMobile />
                </nav>
                 <div className="mt-auto p-4 border-t">
                    <ThemeToggle />
                  </div>
              </SheetContent>
            </Sheet>
             {/* App Title in Mobile Header */}
             <Link href="/app/channels" className="flex items-center gap-2">
                <PlaySquare className="h-7 w-7 text-primary" />
                <h1 className="text-xl font-semibold">StreamVerse</h1>
              </Link>
          </header>
          <main className="flex-1 overflow-y-auto p-6 bg-background">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
