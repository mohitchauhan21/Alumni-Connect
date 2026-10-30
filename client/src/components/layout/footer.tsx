import * as React from 'react';
import Link from 'next/link';
import { Container } from '@/components/layout/container';
import { GraduationCap, ShieldCheck } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30 py-12 text-sm">
      <Container size="wide">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand Info */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="font-bold text-base tracking-tight">
                P11 Alumni Mentorship Platform
              </span>
            </div>
            <p className="text-muted-foreground max-w-md leading-relaxed">
              An institutional platform dedicated to connecting current students with verified
              university alumni for structured professional guidance, transparent career matching,
              and skill development.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Institutional Verification & Privacy Protected Architecture</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground tracking-tight">Platform</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link href="#how-it-works" className="hover:text-foreground transition-colors">
                  How Matching Works
                </Link>
              </li>
              <li>
                <Link href="#benefits" className="hover:text-foreground transition-colors">
                  Mentorship Tracks
                </Link>
              </li>
              <li>
                <Link href="#verification" className="hover:text-foreground transition-colors">
                  Alumni Verification
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Member Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Institutional Compliance */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground tracking-tight">Governance & Security</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Role-Based Privacy Policy
                </span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Code of Conduct
                </span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Data Protection & Audit
                </span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Career Services Office
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <p>© {currentYear} University Alumni Career Services. All rights reserved.</p>
          <p>Project Code: P11 • Verified Alumni Mentorship & Career Network</p>
        </div>
      </Container>
    </footer>
  );
}
