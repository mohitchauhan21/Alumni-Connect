'use client';

/**
 * client/src/app/mentorship/offers/[id]/page.tsx
 * Individual Mentorship Offering Detail View.
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetMentorshipOffer, ApiError, type MentorshipOfferDTO } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/layout/container';
import { Spinner } from '@/components/ui/spinner';
import { Clock, Users, ShieldCheck, ArrowLeft, Globe, User } from 'lucide-react';

export default function MentorshipOfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const rawId = params?.id;
  const offerId = Array.isArray(rawId) ? rawId[0] : (rawId as string);

  const [offer, setOffer] = React.useState<MentorshipOfferDTO | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    if (offerId && user) {
      const fetchDetail = async () => {
        try {
          setLoading(true);
          const data = await apiGetMentorshipOffer(offerId);
          setOffer(data);
        } catch (err) {
          if (err instanceof ApiError) {
            setErrorMessage(err.message);
          } else {
            setErrorMessage('Failed to load mentorship offering.');
          }
        } finally {
          setLoading(false);
        }
      };
      fetchDetail();
    }
  }, [offerId, user]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (errorMessage || !offer) {
    return (
      <div className="py-12">
        <Container size="default">
          <Card className="border-border/80 text-center py-12 max-w-lg mx-auto">
            <CardContent className="space-y-4">
              <p className="text-sm text-destructive">{errorMessage || 'Offering not found.'}</p>
              <Link href="/mentorship/discover">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Discovery
                </Button>
              </Link>
            </CardContent>
          </Card>
        </Container>
      </div>
    );
  }

  const isOwner = user?.id === offer.alumniId;

  return (
    <div className="py-8 md:py-12 bg-muted/20 min-h-[calc(100vh-10rem)]">
      <Container size="default">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Back Navigation */}
          <div>
            <Link
              href={isOwner ? '/mentorship/offers' : '/mentorship/discover'}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {isOwner ? 'Back to My Offerings' : 'Back to Discovery'}
            </Link>
          </div>

          {/* Offering Header Card */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className="capitalize text-xs font-semibold">
                  Mode: {offer.mode}
                </Badge>
                <Badge
                  variant={offer.status === 'active' ? 'default' : 'secondary'}
                  className="capitalize text-xs"
                >
                  Status: {offer.status}
                </Badge>
              </div>

              <CardTitle className="text-2xl font-bold tracking-tight">{offer.title}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Detailed Description */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Overview & Guidance Scope
                </h3>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {offer.description}
                </p>
              </div>

              {/* Topics Covered */}
              <div className="space-y-2 border-t pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Focus Topics & Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {offer.topics.map((t, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-xs py-1 px-2.5 font-medium"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Mentorship Mechanics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
                <div className="p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
                    <Clock className="h-4 w-4" /> Session Duration
                  </div>
                  <p className="text-base font-bold text-foreground">
                    {offer.sessionDurationMinutes} Minutes
                  </p>
                  <p className="text-[11px] text-muted-foreground">Structured 1-on-1 engagement</p>
                </div>

                <div className="p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
                    <Users className="h-4 w-4" /> Mentee Capacity
                  </div>
                  <p className="text-base font-bold text-foreground">
                    Max {offer.maxMenteesCapacity} Mentees
                  </p>
                  <p className="text-[11px] text-muted-foreground">Monthly guidance quota</p>
                </div>

                <div className="p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
                    <Globe className="h-4 w-4" /> Engagement Mode
                  </div>
                  <p className="text-base font-bold text-foreground capitalize">{offer.mode}</p>
                  <p className="text-[11px] text-muted-foreground">Flexible scheduling</p>
                </div>
              </div>

              {/* Target Audience */}
              <div className="space-y-1.5 border-t pt-4 text-xs">
                <span className="font-semibold text-muted-foreground uppercase">
                  Target Audience:
                </span>
                <p className="text-foreground text-sm font-medium">{offer.targetAudience}</p>
              </div>
            </CardContent>
          </Card>

          {/* Mentor Profile Snapshot (if available) */}
          {offer.alumni && (
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> Meet Your Alumni Mentor
                  </CardTitle>
                  <Badge className="bg-emerald-600 text-white gap-1 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified Graduate
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-base">
                    {offer.alumni.fullName.charAt(0)}
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-base text-foreground">{offer.alumni.fullName}</h4>
                    <p className="text-xs font-medium text-foreground">
                      {offer.alumni.headline ||
                        `${offer.alumni.currentDesignation} at ${offer.alumni.company}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {offer.alumni.programme} • Class of {offer.alumni.graduationYear}
                    </p>
                  </div>
                </div>

                {offer.alumni.bio && (
                  <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
                    {offer.alumni.bio}
                  </p>
                )}

                <div className="border-t pt-3 flex justify-end">
                  <Link href={`/alumni/${offer.alumni.userId}`}>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5">
                      View Full Mentor Profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Container>
    </div>
  );
}
