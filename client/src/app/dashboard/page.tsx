'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/layout/container';
import { Spinner } from '@/components/ui/spinner';
import {
  GraduationCap,
  LogOut,
  LayoutDashboard,
  CheckCircle2,
  ShieldCheck,
  FileSpreadsheet,
  ArrowRight,
  User,
  Compass,
  Sparkles,
} from 'lucide-react';
import { apiGetMyProfile, type StudentProfileDTO, type AlumniProfileDTO } from '@/lib/api';

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
  const [profileData, setProfileData] = React.useState<StudentProfileDTO | AlumniProfileDTO | null>(
    null
  );

  // Redirect unauthenticated users to login (UX guard; backend enforces access control)
  React.useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  // Load profile summary if student or alumni
  React.useEffect(() => {
    if (user && (user.role === 'student' || user.role === 'alumni')) {
      apiGetMyProfile()
        .then(res => {
          if (res && res.profile) {
            setProfileData(res.profile);
          }
        })
        .catch(() => {
          // Ignore profile load error in dashboard overview
        });
    }
  }, [user]);

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

          {/* Alumni Dashboard Cards */}
          {user.role === 'alumni' && (
            <>
              {/* Profile Completion & Mentorship Offerings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-border/80 shadow-sm flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Professional Profile
                      </span>
                      {profileData && (
                        <Badge
                          variant={
                            (profileData as AlumniProfileDTO).isDraft ? 'secondary' : 'default'
                          }
                        >
                          {(profileData as AlumniProfileDTO).isDraft ? 'Draft' : 'Published'}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {profileData
                        ? `Profile is ${profileData.completionPercentage}% complete. Keep your industry experience and expertise topics current.`
                        : 'Complete your professional profile, industry domain, experience, and mentorship topics.'}
                    </p>
                    {profileData && (
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${profileData.completionPercentage}%` }}
                        />
                      </div>
                    )}
                    <div className="pt-1">
                      <Link href="/profile">
                        <Button size="sm" variant="outline" className="gap-2">
                          Manage Profile <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/80 shadow-sm flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Mentorship Offerings
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Publish mentorship offerings with topics, capacity limits, and preferred
                      session modes for verified students.
                    </p>
                    <div className="pt-1">
                      <Link href="/mentorship/offers">
                        <Button size="sm" className="gap-2">
                          Manage Offerings <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Institutional Verification Card */}
              <Card className="border-primary/40 bg-card shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Institutional Alumni Verification
                    </span>
                    <Badge variant="outline" className="text-xs font-semibold">
                      Institutional Status
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Verify your degree credentials against official institutional rosters to unlock
                    mentor profiles, mentee capacity controls, and matching eligibility.
                  </p>
                  <div className="pt-2">
                    <Link href="/verification">
                      <Button size="sm" variant="outline" className="gap-2">
                        Go to Verification Portal <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {(user.role === 'alumni_officer' || user.role === 'admin') && (
            <Card className="border-primary/40 bg-card shadow-sm space-y-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Officer Verification Operations
                  </span>
                  <Badge variant="outline" className="text-xs font-semibold">
                    Phase 3
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Review pending alumni verification submissions, evaluate matching results, and
                  import official graduation roster CSV files.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/officer/verifications">
                    <Button size="sm" className="gap-2">
                      <ShieldCheck className="h-4 w-4" /> Open Verification Queue
                    </Button>
                  </Link>
                  <Link href="/officer/verifications/import">
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileSpreadsheet className="h-4 w-4" /> Import Roster CSV
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Student Dashboard Cards */}
          {user.role === 'student' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Profile Card */}
                <Card className="border-border/80 bg-card shadow-sm flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Academic & Career Profile
                      </span>
                      {profileData && (
                        <Badge
                          variant={profileData.completionPercentage >= 80 ? 'default' : 'secondary'}
                        >
                          {profileData.completionPercentage}% Complete
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {profileData
                        ? `Profile is ${profileData.completionPercentage}% complete. A complete profile improves matching quality with alumni mentors.`
                        : 'Set up your programme, graduation year, skills, career interests, and mentorship goals.'}
                    </p>
                    {profileData && (
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${profileData.completionPercentage}%` }}
                        />
                      </div>
                    )}
                    <div className="pt-1">
                      <Link href="/profile">
                        <Button size="sm" className="gap-2">
                          Edit Profile <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                {/* Explore Mentorship Card */}
                <Card className="border-border/80 bg-card shadow-sm flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Compass className="h-5 w-5 text-primary" />
                      Explore Mentorship Offers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Browse active mentorship opportunities published by verified alumni across
                      diverse industries and domains.
                    </p>
                    <div className="pt-1">
                      <Link href="/mentorship/discover">
                        <Button size="sm" variant="outline" className="gap-2">
                          Browse Offerings <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
