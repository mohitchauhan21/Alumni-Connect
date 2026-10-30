'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/layout/container';
import { GraduationCap, Menu, X, ShieldCheck } from 'lucide-react';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <Container size="wide">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <Link
            href="/"
            id="nav-brand-link"
            className="flex items-center space-x-2 text-foreground transition-opacity hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight leading-tight flex items-center gap-1.5">
                Alumni Network <ShieldCheck className="h-4 w-4 text-primary inline" />
              </span>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                Mentorship Platform
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link
              href="#how-it-works"
              id="nav-link-how-it-works"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              How It Works
            </Link>
            <Link
              href="#benefits"
              id="nav-link-benefits"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Programme Benefits
            </Link>
            <Link
              href="#verification"
              id="nav-link-verification"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Verification Standards
            </Link>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            <Link href="/login" id="nav-btn-login">
              <Button variant="ghost" size="sm">
                Log In
              </Button>
            </Link>
            <Link href="/register" id="nav-btn-register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden">
            <button
              type="button"
              id="nav-mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t py-4 space-y-3">
            <nav className="flex flex-col space-y-3 px-2">
              <Link
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground py-1"
              >
                How It Works
              </Link>
              <Link
                href="#benefits"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground py-1"
              >
                Programme Benefits
              </Link>
              <Link
                href="#verification"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground py-1"
              >
                Verification Standards
              </Link>
            </nav>
            <div className="flex flex-col space-y-2 pt-2 border-t px-2">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full justify-center">
                  Log In
                </Button>
              </Link>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full justify-center">Get Started</Button>
              </Link>
            </div>
          </div>
        )}
      </Container>
    </header>
  );
}
