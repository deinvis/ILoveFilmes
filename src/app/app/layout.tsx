
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tv2, Film, Clapperboard, Settings as SettingsIcon, PlaySquare, Menu } from 'lucide-react';
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
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader as MobileSheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'; // Updated import
import React from 'react';

const navItems = [
  { href: '/app/channels', label: 'Channels', icon: Tv2 },
  { href: '/app/movies', label: 'Movies', icon: Film },
  { href: '/app/series', label: 'Series', icon: Clapperboard },
  { href: '/app/settings', label: 'Settings', icon: SettingsIcon },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileSheetOpen, setIsMobileSheetOpen] = React.useState(false);

  const NavLinks = ({isMobile = false}: {isMobile?: boolean}) => (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              isActive={pathname === item.href}
              className="w-full justify-start"
              onClick={() => isMobile && setIsMobileSheetOpen(false)}
              tooltip={item.label}
            >
              <item.icon className="h-5 w-5" />
              <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
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
                <MobileSheetHeader className="p-4 border-b">
                   <Link href="/app/channels" className="flex items-center gap-2" onClick={() => setIsMobileSheetOpen(false)}>
                      <PlaySquare className="h-8 w-8 text-primary" />
                      <SheetTitle className="text-xl font-bold">StreamVerse</SheetTitle>
                    </Link>
                </MobileSheetHeader>
                <nav className="grid gap-2 text-lg font-medium p-4">
                  <NavLinks isMobile />
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
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
