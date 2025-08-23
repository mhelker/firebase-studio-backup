"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Menu, Zap, LogIn, LogOut, UserCircle, CalendarDays, Lightbulb } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Header() {
  const { user, loading, logOut, imageUrl } = useAuth();
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Home', icon: <Zap className="md:hidden mr-2 h-5 w-5"/> },
    { href: '/performers', label: 'Performers', icon: <UserCircle className="md:hidden mr-2 h-5 w-5"/> },
    { href: '/recommendations', label: 'AI Picks', icon: <Zap className="md:hidden mr-2 h-5 w-5"/> },
    { href: '/suggestions', label: 'Suggestions', icon: <Lightbulb className="md:hidden mr-2 h-5 w-5"/> },
    { href: '/book-talent', label: 'Book Talent', icon: <Zap className="md:hidden mr-2 h-5 w-5"/> },
  ];
  
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';

  // --- CHANGE 1: THE LOGIC IS UPDATED HERE ---
  const isUserPageActive = pathname === '/profile' || pathname === '/bookings' || pathname === '/dashboard';

  return (
    <header className="bg-card shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-2xl font-headline font-bold text-primary">
          <Zap className="h-7 w-7" />
          <span>TalentHop</span>
        </Link>
        
        <nav className="hidden md:flex items-center space-x-2">
          {navItems.map((item) => (
            <Button 
              key={item.label} 
              variant={pathname === item.href ? "secondary" : "ghost"} 
              asChild
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
          
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse ml-2" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className={cn(
                    "relative h-10 w-10 rounded-full ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isUserPageActive && "ring-2 ring-ring ring-offset-2 ring-offset-background"
                  )} 
                  suppressHydrationWarning
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={imageUrl || ''} alt="User avatar" data-ai-hint="person portrait" />
                    <AvatarFallback>{userInitial}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">My Account</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* --- CHANGE 2: THE DASHBOARD LINK IS ADDED HERE --- */}
                <DropdownMenuItem asChild>
                  <Link href="/dashboard"><UserCircle className="mr-2 h-4 w-4" /> Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile"><UserCircle className="mr-2 h-4 w-4" /> Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/bookings"><CalendarDays className="mr-2 h-4 w-4" /> My Bookings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
             <Button variant="ghost" asChild>
              <Link href="/login" suppressHydrationWarning><LogIn className="mr-2 h-4 w-4" /> Login</Link>
            </Button>
          )}
        </nav>

        {/* --- MOBILE MENU --- */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px] flex flex-col">
              <SheetHeader className="mb-6 border-b pb-4">
                <SheetTitle className="text-xl text-primary flex items-center gap-2">
                   <Zap className="h-6 w-6" /> TalentHop Menu
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col space-y-3 flex-grow">
                {navItems.map((item) => (
                  <Button 
                    key={item.label} 
                    variant={pathname === item.href ? "secondary" : "ghost"} 
                    className="w-full justify-start text-md py-3" 
                    asChild
                  >
                    <Link href={item.href} className="flex items-center">
                      {item.icon} {item.label}
                    </Link>
                  </Button>
                ))}
              </nav>
              <div className="mt-auto">
                <hr className="my-3"/>
                {loading ? (
                    <div className="w-full h-10 rounded-md bg-muted animate-pulse" />
                  ) : user ? (
                  <div className="space-y-3">
                    {/* You may also want to add a Dashboard link here for mobile */}
                    <Button variant="ghost" className="w-full justify-start text-md py-3" asChild>
                      <Link href="/profile"><UserCircle className="mr-2 h-5 w-5" /> Profile</Link>
                    </Button>
                     <Button variant="ghost" className="w-full justify-start text-md py-3" asChild>
                      <Link href="/bookings"><CalendarDays className="mr-2 h-5 w-5" /> My Bookings</Link>
                    </Button>
                    <Button variant="ghost" onClick={logOut} className="w-full justify-start text-md py-3">
                      <LogOut className="mr-2 h-5 w-5" /> Logout
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" asChild className="w-full justify-start text-md py-3">
                    <Link href="/login" className="flex items-center" suppressHydrationWarning>
                      <LogIn className="mr-2 h-5 w-5" /> Login
                    </Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}