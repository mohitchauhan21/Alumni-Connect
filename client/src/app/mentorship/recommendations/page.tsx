'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiGetRecommendations,
  apiGetMatchingWeights,
  ApiError,
  type RecommendationDTO,
  type MatchingWeightsDTO,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/layout/container';
import { Spinner } from '@/components/ui/spinner';
import {
  Sparkles,
  Target,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  Briefcase,
  Users,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Building,
} from 'lucide-react';

export default function RecommendationsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [recommendations, setRecommendations] = React.useState<RecommendationDTO[]>([]);
  const [weightsConfig, setWeightsConfig] = React.useState<MatchingWeightsDTO | null>(null);
  const [studentCoverage, setStudentCoverage] = React.useState<number>(0);
  const [hasInsufficientData, setHasInsufficientData] = React.useState<boolean>(false);
  const [guidanceMessage, setGuidanceMessage] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState<boolean>(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Filters & Pagination
  const [modeFilter, setModeFilter] = React.useState<string>('all');
  const [industryFilter, setIndustryFilter] = React.useState<string>('all');
  const [topicSearch, setTopicSearch] = React.useState<string>('');
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [totalPages, setTotalPages] = React.useState<number>(1);
  const [totalCount, setTotalCount] = React.useState<number>(0);

  // UI State: expanded explanation cards
  const [expandedCards, setExpandedCards] = React.useState<Record<string, boolean>>({});
  const [showWeightsModal, setShowWeightsModal] = React.useState<boolean>(false);
  const [selectedOfferForDetail, setSelectedOfferForDetail] =
    React.useState<RecommendationDTO | null>(null);

  // Authentication guard (Students only)
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    } else if (!authLoading && user && user.role !== 'student') {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  // Load weights configuration
  React.useEffect(() => {
    apiGetMatchingWeights()
      .then(setWeightsConfig)
      .catch(() => {
        // Non-blocking fallback
      });
  }, []);

  // Fetch recommendations
  const loadRecommendations = React.useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await apiGetRecommendations({
        page: currentPage,
        limit: 9,
        mode: modeFilter !== 'all' ? modeFilter : undefined,
        industry: industryFilter !== 'all' ? industryFilter : undefined,
        topic: topicSearch.trim() || undefined,
      });

      setRecommendations(res.recommendations);
      setStudentCoverage(res.studentCoverage);
      setHasInsufficientData(res.hasInsufficientData);
      setGuidanceMessage(res.guidanceMessage);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalCount(res.pagination.total || 0);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to compute mentor recommendations.');
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, modeFilter, industryFilter, topicSearch]);

  React.useEffect(() => {
    if (user?.role === 'student') {
      loadRecommendations();
    }
  }, [user, loadRecommendations]);

  const toggleExpandCard = (offerId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [offerId]: !prev[offerId],
    }));
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Strong Match':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      case 'Good Match':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
      case 'Moderate Match':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
      default:
        return 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/30';
    }
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 65) return 'text-blue-600 dark:text-blue-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-muted-foreground';
  };

  if (authLoading || (!user && !errorMessage)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="py-8 md:py-12 bg-muted/20 min-h-[calc(100vh-10rem)]">
      <Container size="wide">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Target className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Recommended Mentors</h1>
                <Badge variant="outline" className="text-xs font-semibold gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Explainable Match
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Personalized, deterministic recommendations evaluated across 6 criteria: mentorship
                topics, skills, career domain, delivery mode, academic department, and languages.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWeightsModal(true)}
                className="gap-2"
              >
                <Info className="h-4 w-4" />
                Matching Weights
              </Button>
            </div>
          </div>

          {/* Insufficient Data Warning Banner */}
          {hasInsufficientData && (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Incomplete Profile Evidence</p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                    {guidanceMessage ||
                      'Your profile covers less than 40% of the evaluation criteria. Complete your profile details to unlock higher confidence recommendations.'}
                  </p>
                </div>
              </div>
              <Link href="/profile">
                <Button size="sm" variant="default" className="shrink-0 gap-1.5 shadow-xs">
                  Complete Profile <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}

          {/* Filters Bar & Coverage Meter */}
          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Search & Select Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto flex-1">
                  <div>
                    <input
                      type="text"
                      placeholder="Search by topic (e.g. React, Cloud)..."
                      value={topicSearch}
                      onChange={e => {
                        setTopicSearch(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>

                  <div>
                    <select
                      value={modeFilter}
                      aria-label="Mentorship Mode Filter"
                      onChange={e => {
                        setModeFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="all">All Delivery Modes</option>
                      <option value="online">Online</option>
                      <option value="in-person">In-person</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={industryFilter}
                      aria-label="Industry Domain Filter"
                      onChange={e => {
                        setIndustryFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="all">All Industries</option>
                      <option value="Software Development">Software Development</option>
                      <option value="Cloud Computing">Cloud Computing</option>
                      <option value="Artificial Intelligence">Artificial Intelligence</option>
                      <option value="Cybersecurity">Cybersecurity</option>
                      <option value="Data Science & Analytics">Data Science & Analytics</option>
                      <option value="Finance & Fintech">Finance & Fintech</option>
                    </select>
                  </div>
                </div>

                {/* Evidence Coverage Indicator */}
                <div className="flex items-center gap-3 shrink-0 bg-muted/40 px-3 py-1.5 rounded-lg border text-xs">
                  <div className="flex flex-col text-right">
                    <span className="font-semibold text-foreground">
                      Profile Evidence: {studentCoverage}%
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {studentCoverage >= 80
                        ? 'High Confidence'
                        : studentCoverage >= 50
                          ? 'Good Coverage'
                          : 'Partial Data'}
                    </span>
                  </div>
                  <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        studentCoverage >= 80
                          ? 'bg-emerald-500'
                          : studentCoverage >= 40
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                      }`}
                      style={{ width: `${studentCoverage}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i} className="animate-pulse border-border/80 p-6 space-y-4">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-16 bg-muted rounded w-full" />
                  <div className="h-8 bg-muted rounded w-1/2" />
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && recommendations.length === 0 && (
            <Card className="border-border/80 text-center py-12 px-4 space-y-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Target className="h-6 w-6" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="font-semibold text-lg">No Matching Offerings Found</h3>
                <p className="text-sm text-muted-foreground">
                  {guidanceMessage ||
                    'No eligible active mentorship offerings match your current profile criteria and filters.'}
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setModeFilter('all');
                    setIndustryFilter('all');
                    setTopicSearch('');
                  }}
                >
                  Clear Filters
                </Button>
                <Link href="/profile">
                  <Button size="sm">Update Profile Details</Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Recommendations Grid */}
          {!loading && recommendations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.map(rec => {
                const isExpanded = Boolean(expandedCards[rec.offerId]);

                return (
                  <Card
                    key={rec.offerId}
                    className="border-border/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header: Compatibility Pill + Category */}
                      <CardHeader className="pb-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-2xl font-black tracking-tight ${getScoreColorClass(
                                rec.compatibilityScore
                              )}`}
                            >
                              {rec.compatibilityScore}%
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold ${getCategoryBadgeClass(
                                rec.matchCategory
                              )}`}
                            >
                              {rec.matchCategory}
                            </Badge>
                          </div>
                          <Badge
                            variant="secondary"
                            className="text-[11px] font-medium"
                            title="Proportion of scoring criteria assessable from available profile data"
                          >
                            Coverage: {rec.dataCoverage}%
                          </Badge>
                        </div>

                        {/* Offering Title */}
                        <CardTitle className="text-base font-bold line-clamp-2 text-foreground">
                          {rec.offering.title}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Mentor Snapshot */}
                        <div className="flex items-start gap-3 bg-muted/40 p-3 rounded-lg border border-border/60">
                          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs uppercase">
                            {rec.mentor.name.slice(0, 2)}
                          </div>
                          <div className="space-y-0.5 overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-xs text-foreground truncate">
                                {rec.mentor.name}
                              </span>
                              <span title="Verified Graduate">
                                <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {rec.mentor.headline || rec.mentor.currentDesignation || 'Alumni'}
                            </p>
                            {rec.mentor.company && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                <Building className="h-3 w-3 shrink-0" /> {rec.mentor.company}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Topics */}
                        <div className="flex flex-wrap gap-1.5">
                          {rec.offering.topics.slice(0, 3).map((topic, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-[11px] font-normal"
                            >
                              {topic}
                            </Badge>
                          ))}
                          {rec.offering.topics.length > 3 && (
                            <span className="text-[11px] text-muted-foreground self-center">
                              +{rec.offering.topics.length - 3} more
                            </span>
                          )}
                        </div>

                        {/* Offering Details Bar */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                          <span className="flex items-center gap-1 capitalize">
                            <Briefcase className="h-3.5 w-3.5 text-primary" /> {rec.offering.mode}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-primary" />{' '}
                            {rec.offering.sessionDurationMinutes} mins
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-primary" /> Cap:{' '}
                            {rec.offering.maxMenteesCapacity}
                          </span>
                        </div>

                        {/* Match Summary */}
                        <p className="text-xs text-muted-foreground leading-relaxed italic bg-muted/20 p-2.5 rounded border border-border/40">
                          &ldquo;{rec.explanation.summary}&rdquo;
                        </p>

                        {/* Expandable Evidence Section */}
                        {isExpanded && (
                          <div className="space-y-3 pt-2 border-t text-xs">
                            <p className="font-semibold text-foreground flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-primary" /> 6-Criteria Evidence
                              Breakdown
                            </p>
                            <div className="space-y-2">
                              {rec.breakdown.map(crit => (
                                <div
                                  key={crit.criterionKey}
                                  className="p-2 rounded bg-background border space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-[11px] text-foreground">
                                      {crit.criterionLabel} ({crit.weight}%)
                                    </span>
                                    <span
                                      className={`text-[11px] font-bold ${
                                        !crit.assessable
                                          ? 'text-muted-foreground'
                                          : crit.score >= 0.7
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : crit.score > 0
                                              ? 'text-blue-600 dark:text-blue-400'
                                              : 'text-amber-600'
                                      }`}
                                    >
                                      {crit.assessable
                                        ? `${Math.round(crit.score * 100)}%`
                                        : 'Not Specified'}
                                    </span>
                                  </div>

                                  <p className="text-[11px] text-muted-foreground leading-snug">
                                    {crit.explanation}
                                  </p>

                                  {crit.matchedValues.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                      {crit.matchedValues.map((v, vi) => (
                                        <span
                                          key={vi}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[10px] bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded border border-emerald-300/40"
                                        >
                                          <CheckCircle2 className="h-2.5 w-2.5" /> {v}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </div>

                    {/* Card Actions */}
                    <div className="p-4 pt-0 space-y-2 border-t mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpandCard(rec.offerId)}
                        className="w-full text-xs text-primary justify-between"
                      >
                        <span>
                          {isExpanded ? 'Hide Match Reasons' : 'Why this mentor matches you'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Link href={`/alumni/${rec.mentor.userId}`} className="w-full">
                          <Button variant="outline" size="sm" className="w-full text-xs">
                            View Profile
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full text-xs"
                          onClick={() => setSelectedOfferForDetail(rec)}
                        >
                          Match Details
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t text-sm">
              <span className="text-muted-foreground text-xs">
                Showing page {currentPage} of {totalPages} ({totalCount} recommendations)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="gap-1 text-xs"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="gap-1 text-xs"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </Container>

      {/* Matching Weights Explainer Modal */}
      {showWeightsModal && weightsConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border-border animate-in fade-in zoom-in-95">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg font-bold">Matching Algorithm & Weights</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowWeightsModal(false)}
                  className="h-8 w-8"
                >
                  ✕
                </Button>
              </div>
              <CardDescription>
                Deterministic multi-criteria scoring algorithm configured across 6 weighted
                dimensions (Total: {weightsConfig.totalWeight}%).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                {weightsConfig.criteria.map(c => (
                  <div key={c.key} className="p-3 rounded-lg border bg-muted/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground">{c.label}</span>
                      <Badge variant="secondary" className="font-bold">
                        {c.weight}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t space-y-2 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Score Normalization & Confidence:</p>
                <p>
                  Scores are calculated strictly over assessable criteria using the formula:{' '}
                  <code className="text-primary font-mono text-[11px]">
                    S = (Σ wi * si) / (Σ wi) * 100
                  </code>
                  . Missing student preferences are never counted as successful matches and are
                  excluded from the denominator.
                </p>
                <p>
                  A minimum data coverage threshold of {weightsConfig.minCoverageThreshold}% is
                  required to produce reliable recommendations.
                </p>
              </div>

              <div className="pt-3 flex justify-end">
                <Button size="sm" onClick={() => setShowWeightsModal(false)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Recommendation Breakdown Modal */}
      {selectedOfferForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-border animate-in fade-in zoom-in-95">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold ${getCategoryBadgeClass(
                      selectedOfferForDetail.matchCategory
                    )}`}
                  >
                    {selectedOfferForDetail.matchCategory} •{' '}
                    {selectedOfferForDetail.compatibilityScore}%
                  </Badge>
                  <CardTitle className="text-lg font-bold mt-1">
                    {selectedOfferForDetail.offering.title}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedOfferForDetail(null)}
                  className="h-8 w-8"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {/* Mentor Summary */}
              <div className="p-3 rounded-lg border bg-muted/30 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-foreground">{selectedOfferForDetail.mentor.name}</p>
                  <p className="text-muted-foreground">
                    {selectedOfferForDetail.mentor.headline} •{' '}
                    {selectedOfferForDetail.mentor.company}
                  </p>
                  {selectedOfferForDetail.mentor.verifiedProgramme && (
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      Verified Alumnus: {selectedOfferForDetail.mentor.verifiedProgramme} (
                      {selectedOfferForDetail.mentor.verifiedDepartment})
                    </p>
                  )}
                </div>
                <Link href={`/alumni/${selectedOfferForDetail.mentor.userId}`}>
                  <Button variant="outline" size="sm" className="text-xs">
                    View Mentor Profile
                  </Button>
                </Link>
              </div>

              {/* Full Criteria Breakdown */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-primary" /> Detailed Criteria Breakdown
                </h4>
                <div className="space-y-2">
                  {selectedOfferForDetail.breakdown.map(c => (
                    <div
                      key={c.criterionKey}
                      className="p-3 rounded-lg border bg-background space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground">
                          {c.criterionLabel}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Weight: {c.weight}%
                          </span>
                          <Badge
                            variant={
                              !c.assessable ? 'outline' : c.score >= 0.7 ? 'default' : 'secondary'
                            }
                            className="text-xs font-bold"
                          >
                            {c.assessable ? `${Math.round(c.score * 100)}%` : 'Unavailable'}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">{c.explanation}</p>

                      {c.matchedValues.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                            Matched:
                          </span>
                          {c.matchedValues.map((mv, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded text-[11px]"
                            >
                              {mv}
                            </span>
                          ))}
                        </div>
                      )}

                      {c.unmatchedStudentValues.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Unmatched student preferences:
                          </span>
                          {c.unmatchedStudentValues.map((uv, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.2 bg-muted text-muted-foreground rounded text-[11px]"
                            >
                              {uv}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Strengths & Gaps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
                <div className="p-3 rounded-lg border border-emerald-300/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1.5">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Strongest Alignments
                  </p>
                  <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                    {selectedOfferForDetail.explanation.strengths.length > 0 ? (
                      selectedOfferForDetail.explanation.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))
                    ) : (
                      <li>No criteria reached high alignment threshold.</li>
                    )}
                  </ul>
                </div>

                <div className="p-3 rounded-lg border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-1.5">
                  <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4" /> Identified Gaps
                  </p>
                  <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                    {selectedOfferForDetail.explanation.gaps.length > 0 ? (
                      selectedOfferForDetail.explanation.gaps.map((g, i) => <li key={i}>{g}</li>)
                    ) : (
                      <li>No significant gaps identified in assessable criteria.</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-between items-center">
                <Link href={`/mentorship/offers/${selectedOfferForDetail.offerId}`}>
                  <Button variant="outline" size="sm" className="text-xs">
                    View Offering Full Page
                  </Button>
                </Link>
                <Button size="sm" onClick={() => setSelectedOfferForDetail(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
