'use client';

/**
 * client/src/app/mentorship/discover/page.tsx
 * Mentorship Offering Discovery & Browsing for Students and Platform Users.
 * Server-side search, filtering, and pagination.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiDiscoverMentorshipOffers, ApiError, type MentorshipOfferDTO } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/layout/container';
import { Spinner } from '@/components/ui/spinner';
import {
  Search,
  Filter,
  Clock,
  Users,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  User,
} from 'lucide-react';

export default function MentorshipDiscoveryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [offers, setOffers] = React.useState<MentorshipOfferDTO[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Search & Filter state
  const [search, setSearch] = React.useState('');
  const [topic, setTopic] = React.useState('all');
  const [industry, setIndustry] = React.useState('all');
  const [mode, setMode] = React.useState<string>('all');

  // RBAC: require authentication
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const loadOffers = React.useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await apiDiscoverMentorshipOffers({
        page,
        limit: 9,
        search: search.trim() || undefined,
        topic: topic !== 'all' ? topic : undefined,
        industry: industry !== 'all' ? industry : undefined,
        mode: mode !== 'all' ? mode : undefined,
      });

      setOffers(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load mentorship offerings.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, topic, industry, mode]);

  React.useEffect(() => {
    if (user) {
      loadOffers();
    }
  }, [user, loadOffers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadOffers();
  };

  const handleClearFilters = () => {
    setSearch('');
    setTopic('all');
    setIndustry('all');
    setMode('all');
    setPage(1);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="py-8 md:py-12 bg-muted/20 min-h-[calc(100vh-10rem)]">
      <Container size="wide">
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Mentorship Opportunities</h1>
                <Badge variant="outline" className="gap-1 border-primary/40 text-primary text-xs">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified Alumni
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Explore structured 1-on-1 mentorship programs offered by verified university
                graduates across diverse industries.
              </p>
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Showing <span className="font-bold text-foreground">{offers.length}</span> of{' '}
              <span className="font-bold text-foreground">{total}</span> available offerings
            </div>
          </div>

          {/* Search & Filters Card */}
          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-4 space-y-3">
              <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by topic, keyword, headline, company..."
                    className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={mode}
                    onChange={e => {
                      setMode(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Modes</option>
                    <option value="online">Online</option>
                    <option value="in-person">In-Person</option>
                    <option value="hybrid">Hybrid</option>
                  </select>

                  <select
                    value={industry}
                    onChange={e => {
                      setIndustry(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Industries</option>
                    <option value="Technology">Technology</option>
                    <option value="Finance">Finance</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Consulting">Consulting</option>
                  </select>

                  <Button type="submit" size="sm" className="gap-1.5 h-9">
                    <Filter className="h-3.5 w-3.5" /> Apply
                  </Button>

                  {(search || mode !== 'all' || industry !== 'all' || topic !== 'all') && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="h-9 text-xs text-muted-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              {errorMessage}
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <Spinner className="h-8 w-8 text-primary" />
              <p className="text-xs text-muted-foreground">
                Discovering active mentorship offerings...
              </p>
            </div>
          ) : offers.length === 0 ? (
            /* Empty State */
            <Card className="border-dashed border-2 border-border/80 text-center py-16">
              <CardContent className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-foreground text-base">
                  No Mentorship Offerings Found
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  No offerings match your current search criteria. Try modifying your search
                  keywords or resetting filters.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="mt-2 text-xs"
                >
                  Reset All Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            /* Offerings Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {offers.map(offer => (
                <Card
                  key={offer.id}
                  className="border-border/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    {/* Alumnus Identity Header */}
                    {offer.alumni && (
                      <div className="flex items-center gap-3 border-b pb-3 mb-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {offer.alumni.fullName.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                          <Link
                            href={`/alumni/${offer.alumni.userId}`}
                            className="font-semibold text-sm hover:underline text-foreground flex items-center gap-1.5"
                          >
                            <span className="truncate">{offer.alumni.fullName}</span>
                            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                          </Link>
                          <p className="text-xs text-muted-foreground truncate">
                            {offer.alumni.headline ||
                              `${offer.alumni.currentDesignation} at ${offer.alumni.company}`}
                          </p>
                        </div>
                      </div>
                    )}

                    <CardTitle className="text-base font-bold tracking-tight line-clamp-1">
                      {offer.title}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-3 mt-1.5 leading-relaxed">
                      {offer.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    {/* Topics */}
                    <div className="flex flex-wrap gap-1.5">
                      {offer.topics.slice(0, 3).map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground"
                        >
                          {t}
                        </span>
                      ))}
                      {offer.topics.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded text-[11px] text-muted-foreground">
                          +{offer.topics.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{offer.sessionDurationMinutes} min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>Max {offer.maxMenteesCapacity}</span>
                      </div>
                      <div className="capitalize text-right font-medium text-foreground">
                        {offer.mode}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="border-t pt-3 flex items-center justify-between gap-2">
                      {offer.alumni && (
                        <Link href={`/alumni/${offer.alumni.userId}`}>
                          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                            <User className="h-3.5 w-3.5" /> Mentor Bio
                          </Button>
                        </Link>
                      )}
                      <Link href={`/mentorship/offers/${offer.id}`} className="ml-auto">
                        <Button size="sm" className="h-8 text-xs gap-1.5">
                          View Offering <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="gap-1 text-xs"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-xs text-muted-foreground font-medium px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="gap-1 text-xs"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
