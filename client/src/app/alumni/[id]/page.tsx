'use client';

/**
 * client/src/app/alumni/[id]/page.tsx
 * Public Alumni Professional Profile Page.
 * Displays authoritative verified institutional credentials alongside
 * industry experience, skills, and mentorship topics.
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetPublicAlumniProfile, ApiError, type PublicAlumniProfileDTO } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/layout/container';
import { Spinner } from '@/components/ui/spinner';
import { GraduationCap, ShieldCheck, ArrowLeft, Building, Clock, Sparkles } from 'lucide-react';

export default function PublicAlumniProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const rawId = params?.id;
  const userId = Array.isArray(rawId) ? rawId[0] : (rawId as string);

  const [profile, setProfile] = React.useState<PublicAlumniProfileDTO | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    if (userId && user) {
      const fetchProfile = async () => {
        try {
          setLoading(true);
          const data = await apiGetPublicAlumniProfile(userId);
          setProfile(data);
        } catch (err) {
          if (err instanceof ApiError) {
            setErrorMessage(err.message);
          } else {
            setErrorMessage('Alumni profile is currently not available.');
          }
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
    }
  }, [userId, user]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (errorMessage || !profile) {
    return (
      <div className="py-12">
        <Container size="default">
          <Card className="border-border/80 text-center py-12 max-w-lg mx-auto">
            <CardContent className="space-y-4">
              <p className="text-sm text-destructive">
                {errorMessage || 'Alumni profile not found.'}
              </p>
              <Link href="/mentorship/discover">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Mentorship Discovery
                </Button>
              </Link>
            </CardContent>
          </Card>
        </Container>
      </div>
    );
  }

  return (
    <div className="py-8 md:py-12 bg-muted/20 min-h-[calc(100vh-10rem)]">
      <Container size="default">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Back button */}
          <div>
            <Link
              href="/mentorship/discover"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Mentorship Discovery
            </Link>
          </div>

          {/* Hero Identity Card */}
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl shadow-sm">
                  {profile.fullName.charAt(0)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">{profile.fullName}</h1>
                    <Badge className="bg-emerald-600 text-white gap-1 text-xs">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verified Graduate
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {profile.headline || `${profile.currentDesignation} at ${profile.company}`}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
                    <span className="flex items-center gap-1">
                      <Building className="h-3.5 w-3.5" /> {profile.company} ({profile.industry})
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {profile.yearsOfExperience} years experience
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verified Institutional Education */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" /> Verified University Education
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/40 p-3 rounded-lg border text-xs">
                <div>
                  <p className="text-muted-foreground uppercase font-medium">Programme</p>
                  <p className="font-semibold text-foreground">{profile.programme}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase font-medium">Department</p>
                  <p className="font-semibold text-foreground">{profile.department}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase font-medium">Graduation Year</p>
                  <p className="font-semibold text-foreground">Class of {profile.graduationYear}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bio */}
          {profile.bio && (
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">About & Career Journey</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {profile.bio}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Expertise & Topics */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Mentorship Capabilities & Expertise
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {profile.mentorshipTopics.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Mentorship Topics
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.mentorshipTopics.map((topic, idx) => (
                      <Badge key={idx} variant="default" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {profile.areasOfExpertise.length > 0 && (
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Areas of Expertise
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.areasOfExpertise.map((area, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {profile.skills.length > 0 && (
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Technical & Industry Skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-muted text-xs font-medium text-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 border-t pt-3 text-xs">
                <div>
                  <span className="font-semibold text-muted-foreground uppercase">Languages: </span>
                  <span className="text-foreground">{profile.languages.join(', ')}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground uppercase">
                    Preferred Mode:{' '}
                  </span>
                  <span className="text-foreground capitalize">
                    {profile.preferredMentorshipMode}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </div>
  );
}
