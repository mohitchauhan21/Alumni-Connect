'use client';

/**
 * client/src/app/mentorship/offers/page.tsx
 * Mentorship Offering Management for Verified Alumni.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiGetMyMentorshipOffers,
  apiCreateMentorshipOffer,
  apiUpdateMentorshipOffer,
  apiDeleteMentorshipOffer,
  apiGetMyProfile,
  ApiError,
  type MentorshipOfferDTO,
  type MentorshipMode,
  type OfferingStatus,
  type AlumniProfileDTO,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/layout/container';
import { Spinner } from '@/components/ui/spinner';
import {
  Briefcase,
  Plus,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  X,
  Lock,
  ArrowRight,
} from 'lucide-react';

export default function MentorshipOffersManagementPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [offers, setOffers] = React.useState<MentorshipOfferDTO[]>([]);
  const [alumniProfile, setAlumniProfile] = React.useState<AlumniProfileDTO | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingOfferId, setEditingOfferId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [topicsStr, setTopicsStr] = React.useState('');
  const [targetAudience, setTargetAudience] = React.useState('');
  const [mode, setMode] = React.useState<MentorshipMode>('online');
  const [sessionDurationMinutes, setSessionDurationMinutes] = React.useState<number>(45);
  const [maxMenteesCapacity, setMaxMenteesCapacity] = React.useState<number>(5);
  const [status, setStatus] = React.useState<OfferingStatus>('active');

  // RBAC Guard: only alumni can access this page
  React.useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role !== 'alumni') {
        router.replace('/dashboard');
      }
    }
  }, [user, authLoading, router]);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [offersData, profileData] = await Promise.all([
        apiGetMyMentorshipOffers(),
        apiGetMyProfile(),
      ]);
      setOffers(offersData);
      if (profileData.role === 'alumni') {
        setAlumniProfile(profileData.profile as AlumniProfileDTO);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load mentorship offerings.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (user && user.role === 'alumni') {
      loadData();
    }
  }, [user, loadData]);

  const openCreateModal = () => {
    setEditingOfferId(null);
    setTitle('');
    setDescription('');
    setTopicsStr('');
    setTargetAudience('Undergraduate university students');
    setMode('online');
    setSessionDurationMinutes(45);
    setMaxMenteesCapacity(5);
    setStatus('active');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (offer: MentorshipOfferDTO) => {
    setEditingOfferId(offer.id);
    setTitle(offer.title);
    setDescription(offer.description);
    setTopicsStr(offer.topics.join(', '));
    setTargetAudience(offer.targetAudience);
    setMode(offer.mode);
    setSessionDurationMinutes(offer.sessionDurationMinutes);
    setMaxMenteesCapacity(offer.maxMenteesCapacity);
    setStatus(offer.status);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsedTopics = topicsStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (parsedTopics.length === 0) {
      setErrorMessage('Please provide at least one topic (e.g. Web Development).');
      setActionLoading(false);
      return;
    }

    try {
      if (editingOfferId) {
        await apiUpdateMentorshipOffer(editingOfferId, {
          title,
          description,
          topics: parsedTopics,
          targetAudience,
          mode,
          sessionDurationMinutes: Number(sessionDurationMinutes),
          maxMenteesCapacity: Number(maxMenteesCapacity),
          status,
        });
        setSuccessMessage('Mentorship offering successfully updated.');
      } else {
        await apiCreateMentorshipOffer({
          title,
          description,
          topics: parsedTopics,
          targetAudience,
          mode,
          sessionDurationMinutes: Number(sessionDurationMinutes),
          maxMenteesCapacity: Number(maxMenteesCapacity),
          status,
        });
        setSuccessMessage('Mentorship offering successfully created and published.');
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to save mentorship offering.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string, offerTitle: string) => {
    if (!window.confirm(`Are you sure you want to remove "${offerTitle}"?`)) return;

    try {
      await apiDeleteMentorshipOffer(id);
      setSuccessMessage('Mentorship offering removed.');
      await loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to delete offering.');
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'alumni') return null;

  const isVerified = alumniProfile?.isVerified ?? false;

  return (
    <div className="py-8 md:py-12 bg-muted/20 min-h-[calc(100vh-10rem)]">
      <Container size="wide">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Mentorship Offerings</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Create and manage the structured mentorship domains you offer to undergraduate
                students.
              </p>
            </div>
            <Button onClick={openCreateModal} disabled={!isVerified} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" /> Create New Offering
            </Button>
          </div>

          {/* Verification Guard Banner */}
          {!isVerified && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 shadow-xs">
              <CardContent className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3 text-amber-900 dark:text-amber-200">
                  <Lock className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
                  <div className="text-xs">
                    <p className="font-semibold text-sm">Institutional Verification Required</p>
                    <p className="mt-0.5">
                      To publish mentorship offerings for students, your university degree
                      credentials must be verified by the Alumni Relations Office.
                    </p>
                  </div>
                </div>
                <Link href="/verification">
                  <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0 bg-card">
                    Get Verified <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Alert Messages */}
          {successMessage && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-500/30 text-emerald-800 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Offerings List */}
          {offers.length === 0 ? (
            <Card className="border-dashed border-2 border-border/80 text-center py-12">
              <CardContent className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
                  <Briefcase className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-foreground">No Mentorship Offerings Yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Publish career guidance sessions (e.g. Web Development, System Design, Career
                  Transition) for students to discover.
                </p>
                {isVerified ? (
                  <Button onClick={openCreateModal} size="sm" className="gap-2 mt-2">
                    <Plus className="h-4 w-4" /> Create Your First Offering
                  </Button>
                ) : (
                  <p className="text-xs text-amber-600 font-medium">
                    Complete verification first to unlock offerings.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offers.map(offer => (
                <Card
                  key={offer.id}
                  className="border-border/80 shadow-xs flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-bold tracking-tight">
                        {offer.title}
                      </CardTitle>
                      <Badge
                        variant={
                          offer.status === 'active'
                            ? 'default'
                            : offer.status === 'draft'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="capitalize text-[11px]"
                      >
                        {offer.status}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs line-clamp-2 mt-1">
                      {offer.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {offer.topics.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span>{offer.sessionDurationMinutes} min</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span>Max {offer.maxMenteesCapacity} mentees</span>
                      </div>
                      <div className="capitalize text-right font-medium text-foreground">
                        {offer.mode}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(offer)}
                        className="h-8 text-xs gap-1"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(offer.id, offer.title)}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Create / Edit Modal Dialog */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
              <div className="bg-card w-full max-w-lg rounded-xl border border-border shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b pb-3">
                  <h2 className="text-base font-bold tracking-tight">
                    {editingOfferId ? 'Edit Mentorship Offering' : 'Create Mentorship Offering'}
                  </h2>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Offering Title</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Full-Stack Web Development Career Guidance"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Detailed Description
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Explain what the mentorship covers, prerequisites, and what students will gain..."
                      className="w-full rounded-md border border-input bg-background p-3 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Topics Covered (comma-separated)
                    </label>
                    <input
                      type="text"
                      required
                      value={topicsStr}
                      onChange={e => setTopicsStr(e.target.value)}
                      placeholder="e.g. React, Node.js, System Architecture, Resume Review"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Target Audience</label>
                    <input
                      type="text"
                      required
                      value={targetAudience}
                      onChange={e => setTargetAudience(e.target.value)}
                      placeholder="e.g. 2nd-4th year CS/IT students interested in web development"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Mentorship Mode
                      </label>
                      <select
                        value={mode}
                        onChange={e => setMode(e.target.value as MentorshipMode)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="online">Online</option>
                        <option value="in-person">In-Person</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Session Duration
                      </label>
                      <select
                        value={sessionDurationMinutes}
                        onChange={e => setSessionDurationMinutes(Number(e.target.value))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes</option>
                        <option value={60}>60 Minutes</option>
                        <option value={90}>90 Minutes</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Max Mentee Capacity
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        required
                        value={maxMenteesCapacity}
                        onChange={e => setMaxMenteesCapacity(Number(e.target.value))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Offering Status
                      </label>
                      <select
                        value={status}
                        onChange={e => setStatus(e.target.value as OfferingStatus)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="active">Active (Discoverable)</option>
                        <option value="draft">Draft (Private)</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsModalOpen(false)}
                      disabled={actionLoading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" isLoading={actionLoading}>
                      {editingOfferId ? 'Update Offering' : 'Publish Offering'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
