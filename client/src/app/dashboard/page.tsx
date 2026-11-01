'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/layout/container';
import { Spinner } from '@/components/ui/spinner';
import { GraduationCap, LogOut, LayoutDashboard } from 'lucide-react';

/** Human-readable role labels. */
const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  alumni: 'Alumni',
  alumni_officer: 'Alumni Relations Officer',
  placement_officer: 'Placement Officer',
  admin: 'Administrator',
};

export default function DashboardPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  // Redirect unauthenticated users to login (UX guard; backend enforces access control)
  React.useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Redirecting
  }

  return (
    <div className="py-12 md:py-16 bg-muted/20 min-h-[calc(100vh-10rem)]">
      <Container size="default">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-sm text-muted-foreground">Your account overview</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              isLoading={isLoggingOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>

          {/* User Identity Card */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Account Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
                    Full Name
                  </p>
                  <p className="font-medium">{user.fullName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
                    Email
                  </p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
                    Role
                  </p>
                  <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
                    Account Status
                  </p>
                  <Badge
                    variant={user.accountStatus === 'active' ? 'default' : 'destructive'}
                    className="capitalize"
                  >
                    {user.accountStatus}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Phase Placeholder */}
          <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
            <CardContent className="py-8 text-center space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <h2 className="font-semibold text-foreground">Role-Specific Dashboard</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                The full{' '}
                <span className="font-medium text-foreground">
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>{' '}
                dashboard — including mentorship matching, session scheduling, and programme
                analytics — will be implemented in Phase 3 onwards.
              </p>
              <p className="text-xs text-muted-foreground">
                Authentication and role assignment are fully operational.
              </p>
            </CardContent>
          </Card>
        </div>
      </Container>
    </div>
  );
}
