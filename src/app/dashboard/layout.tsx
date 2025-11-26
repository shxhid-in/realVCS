
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { LogOut, LayoutDashboard, UtensilsCrossed, LineChart, Menu as MenuIcon, MessageSquare, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { ThemeToggle } from '../../components/ThemeToggle';
import { cn } from '../../lib/utils';
import { useOrderCache } from '../../hooks/useOrderCache';
import { useOrderAlert } from '../../hooks/useOrderAlert';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { butcher, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [prevNewOrderCount, setPrevNewOrderCount] = useState(0);
  const { startAlert, stopAlert, isAlerting } = useOrderAlert();
  
  // Create a global stopAlert function that can be called from anywhere
  const globalStopAlert = useCallback(() => {
    stopAlert();
  }, [stopAlert]);
  
  // Make stopAlert available globally
  (window as any).globalStopAlert = globalStopAlert;
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      delete (window as any).globalStopAlert;
    };
  }, []);

  // Global order cache for notifications - orders pushed from Central API via SSE
  const { orders } = useOrderCache({
    butcherId: butcher?.id || '',
    // No refreshInterval - SSE provides real-time updates!
    enabled: !!butcher
  });

  // Filter new orders
  const newOrders = orders.filter(order => order.status === 'new');

  useEffect(() => {
    if (!butcher) {
      router.push('/');
    }
  }, [butcher, router]);

  // Global notification system - works on all tabs
  useEffect(() => {
    
    if (newOrders.length > prevNewOrderCount) {
      startAlert();
    }
    
    // Stop alert when all orders are accepted or rejected (no new orders)
    if (newOrders.length === 0 && prevNewOrderCount > 0) {
      stopAlert();
    }
    
    setPrevNewOrderCount(newOrders.length);
  }, [newOrders.length, prevNewOrderCount, startAlert, stopAlert, isAlerting]);

  if (!butcher) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <div className="text-2xl">Loading...</div>
        </div>
    )
  }

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Order Management" },
    { href: "/dashboard/menu", icon: UtensilsCrossed, label: "Menu Management" },
    { href: "/dashboard/analytics", icon: LineChart, label: "Analytics" },
    { href: "/dashboard/contact", icon: MessageSquare, label: "Contact Admin" },
  ];
  
  const NavLinks = () => (
    <nav className="grid items-start gap-1 text-sm font-medium">
      {navItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 hover:bg-primary/10 hover:shadow-modern group",
            // ✅ FIX: Better contrast for light theme - use foreground color instead of muted
            pathname === item.href 
              ? "bg-primary text-primary-foreground shadow-modern-lg" 
              : "text-foreground/80 dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          )}
        >
          <item.icon className={cn(
            "h-5 w-5 transition-all duration-200",
            pathname === item.href 
              ? "text-primary-foreground" 
              : "text-foreground/70 dark:text-muted-foreground group-hover:text-primary"
          )} />
          <span className="font-medium">{item.label}</span>
          {pathname === item.href && (
            <div className="ml-auto w-2 h-2 rounded-full bg-primary-foreground animate-pulse-slow" />
          )}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-background dark:bg-gradient-to-b dark:from-muted/50 dark:to-muted/30 backdrop-blur-sm md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b border-border/50 px-4 lg:h-[60px] lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-3 font-semibold group">
                <div className="p-2 rounded-lg bg-primary shadow-modern group-hover:shadow-modern-lg transition-all duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-primary-foreground">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="m16 10-4 4-4-4"/>
                  </svg>
                </div>
                <span className="text-foreground group-hover:text-primary transition-colors">VCS</span>
            </Link>
          </div>
          <div className="flex-1 p-2">
            <NavLinks />
          </div>
        </div>
      </div>
      <div className="flex flex-col w-full max-w-full overflow-x-hidden">
        <header className="flex h-14 items-center gap-4 border-b border-border/50 bg-gradient-to-r from-background/95 to-muted/30 backdrop-blur-sm px-4 lg:h-[60px] lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden hover:shadow-modern transition-all duration-200"
              >
                <MenuIcon className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <SheetHeader>
                <SheetTitle>Navigation Menu</SheetTitle>
              </SheetHeader>
              <NavLinks />
            </SheetContent>
          </Sheet>
          <div className="w-full max-w-full flex-1 overflow-x-hidden">
            {/* Can add search bar here if needed */}
          </div>
          
          {/* Global Alert Indicator */}
          {isAlerting && (
            <div className="flex items-center gap-2 animate-bounce-in">
              <div className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-modern-lg animate-pulse-slow">
                <AlertCircle className="h-4 w-4" />
                NEW ORDERS ALERT!
              </div>
            </div>
          )}
          
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full hover:shadow-modern transition-all duration-200">
                <Avatar className="ring-2 ring-primary/20 hover:ring-primary/40 transition-all duration-200">
                  <AvatarImage src={`https://placehold.co/40x40.png?text=${butcher.name.charAt(0)}`} />
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
                    {butcher.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 shadow-modern-lg">
              <DropdownMenuLabel className="font-semibold">My Account</DropdownMenuLabel>
              <DropdownMenuLabel className="text-sm text-muted-foreground font-normal">
                {butcher.name}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-500 focus:bg-red-500/10 transition-colors">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex flex-1 flex-col gap-6 p-4 lg:gap-8 lg:p-6 bg-gradient-to-br from-background via-background to-muted/20">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
