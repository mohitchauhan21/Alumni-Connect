'use client';

/**
 * client/src/app/profile/page.tsx
 * Authenticated User Profile Management (Student & Alumni).
 * Server-calculated completion indicators, verified identity integrity,
 * and draft/published controls.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiGetMyProfile,
  apiUpdateMyProfile,
  ApiError,
  type StudentProfileDTO,
  type AlumniProfileDTO,
  type MentorshipMode,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/layout/container';
import { Spinner } from '@/components/ui/spinner';
import {
  User,
  GraduationCap,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Globe,
  Lock,
  Sparkles,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Profile data states
  const [role, setRole] = React.useState<string>('');
  const [studentProfile, setStudentProfile] = React.useState<StudentProfileDTO | null>(null);
  const [alumniProfile, setAlumniProfile] = React.useState<AlumniProfileDTO | null>(null);

  // Student form state
  const [programme, setProgramme] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [graduationYear, setGraduationYear] = React.useState<number>(new Date().getFullYear() + 1);
  const [skillsStr, setSkillsStr] = React.useState('');
  const [academicInterestsStr, setAcademicInterestsStr] = React.useState('');
  const [careerInterestsStr, setCareerInterestsStr] = React.useState('');
  const [careerGoals, setCareerGoals] = React.useState('');
  const [preferredTopicsStr, setPreferredTopicsStr] = React.useState('');
  const [preferredMode, setPreferredMode] = React.useState<MentorshipMode>('online');
  const [bio, setBio] = React.useState('');

  // Alumni form state
  const [headline, setHeadline] = React.useState('');
  const [currentDesignation, setCurrentDesignation] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [industry, setIndustry] = React.useState('');
  const [yearsOfExperience, setYearsOfExperience] = React.useState<number>(0);
  const [alumniBio, setAlumniBio] = React.useState('');
  const [alumniSkillsStr, setAlumniSkillsStr] = React.useState('');
  const [expertiseStr, setExpertiseStr] = React.useState('');
  const [mentorshipTopicsStr, setMentorshipTopicsStr] = React.useState('');
  const [languagesStr, setLanguagesStr] = React.useState('');
  const [alumniMode, setAlumniMode] = React.useState<MentorshipMode>('online');
  const [isPubliclyVisible, setIsPubliclyVisible] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);

  // Authentication Guard
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Load Profile
  const loadProfile = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGetMyProfile();
      setRole(res.role);

      if (res.role === 'student') {
        const p = res.profile as StudentProfileDTO;
        setStudentProfile(p);
        setProgramme(p.programme || '');
        setDepartment(p.department || '');
        setGraduationYear(p.graduationYear || new Date().getFullYear() + 1);
        setSkillsStr((p.skills || []).join(', '));
        setAcademicInterestsStr((p.academicInterests || []).join(', '));
        setCareerInterestsStr((p.careerInterests || []).join(', '));
        setCareerGoals(p.careerGoals || '');
        setPreferredTopicsStr((p.preferredMentorshipTopics || []).join(', '));
        setPreferredMode(p.preferredMentorshipMode || 'online');
        setBio(p.bio || '');
      } else if (res.role === 'alumni') {
        const p = res.profile as AlumniProfileDTO;
        setAlumniProfile(p);
        setHeadline(p.headline || '');
        setCurrentDesignation(p.currentDesignation || '');
        setCompany(p.company || '');
        setIndustry(p.industry || '');
        setYearsOfExperience(p.yearsOfExperience || 0);
        setAlumniBio(p.bio || '');
        setAlumniSkillsStr((p.skills || []).join(', '));
        setExpertiseStr((p.areasOfExpertise || []).join(', '));
        setMentorshipTopicsStr((p.mentorshipTopics || []).join(', '));
        setLanguagesStr((p.languages || ['English']).join(', '));
        setAlumniMode(p.preferredMentorshipMode || 'online');
        setIsPubliclyVisible(p.isPubliclyVisible);
        setIsDraft(p.isDraft);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load profile.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user, loadProfile]);

  const parseTags = (str: string) =>
    str
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

  // Student Save Handler
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const payload = {
        programme,
        department,
        graduationYear: Number(graduationYear),
        skills: parseTags(skillsStr),
        academicInterests: parseTags(academicInterestsStr),
        careerInterests: parseTags(careerInterestsStr),
        careerGoals,
        preferredMentorshipTopics: parseTags(preferredTopicsStr),
        preferredMentorshipMode: preferredMode,
        bio,
      };

      const res = await apiUpdateMyProfile(payload);
      if (res.role === 'student') {
        setStudentProfile(res.profile as StudentProfileDTO);
        setSuccessMessage('Student profile successfully updated!');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to save profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Alumni Save Handler
  const handleSaveAlumni = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const payload = {
        headline,
        currentDesignation,
        company,
        industry,
        yearsOfExperience: Number(yearsOfExperience),
        bio: alumniBio,
        skills: parseTags(alumniSkillsStr),
        areasOfExpertise: parseTags(expertiseStr),
        mentorshipTopics: parseTags(mentorshipTopicsStr),
        languages: parseTags(languagesStr),
        preferredMentorshipMode: alumniMode,
        isPubliclyVisible,
        isDraft,
      };

      const res = await apiUpdateMyProfile(payload);
      if (res.role === 'alumni') {
        setAlumniProfile(res.profile as AlumniProfileDTO);
        setSuccessMessage('Professional profile successfully updated!');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to update professional profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="py-8 md:py-12 bg-muted/20 min-h-[calc(100vh-10rem)]">
      <Container size="default">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Profile Management</h1>
                <Badge variant="outline" className="capitalize">
                  {role}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {role === 'student'
                  ? 'Manage your academic interests, skills, and mentorship preferences.'
                  : 'Manage your professional background, industry expertise, and visibility.'}
              </p>
            </div>
          </div>

          {/* Alert Banners */}
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

          {/* ────────────────── STUDENT PROFILE VIEW ────────────────── */}
          {role === 'student' && studentProfile && (
            <div className="space-y-6">
              {/* Profile Completion Card */}
              <Card className="border-border/80 shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> Profile Completeness
                    </CardTitle>
                    <span className="text-sm font-bold text-primary">
                      {studentProfile.completionPercentage}%
                    </span>
                  </div>
                  <CardDescription className="text-xs">
                    Complete all sections to improve your mentorship compatibility and
                    opportunities.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${studentProfile.completionPercentage}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Student Form */}
              <form onSubmit={handleSaveStudent} className="space-y-6">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-primary" /> Academic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Programme</label>
                        <input
                          type="text"
                          value={programme}
                          onChange={e => setProgramme(e.target.value)}
                          placeholder="e.g. B.Tech Computer Science"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Department</label>
                        <input
                          type="text"
                          value={department}
                          onChange={e => setDepartment(e.target.value)}
                          placeholder="e.g. Computer Science & Engineering"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Expected Graduation Year
                        </label>
                        <input
                          type="number"
                          value={graduationYear}
                          onChange={e => setGraduationYear(Number(e.target.value))}
                          min={1950}
                          max={2040}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Preferred Mentorship Mode
                        </label>
                        <select
                          value={preferredMode}
                          onChange={e => setPreferredMode(e.target.value as MentorshipMode)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="online">Online (Video/Audio)</option>
                          <option value="in-person">In-Person (Campus)</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-primary" /> Skills & Career Aspirations
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Separate multiple items with commas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Technical & Professional Skills
                      </label>
                      <input
                        type="text"
                        value={skillsStr}
                        onChange={e => setSkillsStr(e.target.value)}
                        placeholder="e.g. TypeScript, React, Python, SQL"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Academic Interests
                      </label>
                      <input
                        type="text"
                        value={academicInterestsStr}
                        onChange={e => setAcademicInterestsStr(e.target.value)}
                        placeholder="e.g. Distributed Systems, Machine Learning, HCI"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Target Career Fields
                      </label>
                      <input
                        type="text"
                        value={careerInterestsStr}
                        onChange={e => setCareerInterestsStr(e.target.value)}
                        placeholder="e.g. Software Engineering, Cloud Architecture, DevOps"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Preferred Mentorship Topics
                      </label>
                      <input
                        type="text"
                        value={preferredTopicsStr}
                        onChange={e => setPreferredTopicsStr(e.target.value)}
                        placeholder="e.g. Resume Review, Mock Interviews, System Design Prep"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Career Goals</label>
                      <textarea
                        rows={3}
                        value={careerGoals}
                        onChange={e => setCareerGoals(e.target.value)}
                        placeholder="Describe your 1-3 year professional objectives..."
                        className="w-full rounded-md border border-input bg-background p-3 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Short Bio</label>
                      <textarea
                        rows={3}
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        placeholder="Brief introduction for mentors..."
                        className="w-full rounded-md border border-input bg-background p-3 text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button type="submit" isLoading={saving} className="gap-2">
                    <Save className="h-4 w-4" /> Save Profile
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ────────────────── ALUMNI PROFESSIONAL PROFILE VIEW ────────────────── */}
          {role === 'alumni' && alumniProfile && (
            <div className="space-y-6">
              {/* Verified Institutional Evidence Banner */}
              <Card className="border-border/80 shadow-xs bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Verified Institutional
                      Credentials
                    </CardTitle>
                    {alumniProfile.isVerified ? (
                      <Badge className="bg-emerald-600 text-white gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" /> Verified Alumni
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                        Verification Pending
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    Degree credentials established in Phase 3 are authoritative and read-only.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg border text-xs">
                    <div>
                      <p className="text-muted-foreground uppercase font-medium">Alumni ID</p>
                      <p className="font-mono font-semibold">
                        {alumniProfile.alumniId || 'Unlinked'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase font-medium">Programme</p>
                      <p className="font-semibold">{alumniProfile.programme || 'Not verified'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase font-medium">Department</p>
                      <p className="font-semibold">{alumniProfile.department || 'Not verified'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase font-medium">Graduation Year</p>
                      <p className="font-semibold">{alumniProfile.graduationYear || '—'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profile Completeness */}
              <Card className="border-border/80 shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> Profile Completeness
                    </CardTitle>
                    <span className="text-sm font-bold text-primary">
                      {alumniProfile.completionPercentage}%
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${alumniProfile.completionPercentage}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Alumni Form */}
              <form onSubmit={handleSaveAlumni} className="space-y-6">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-primary" /> Professional Identity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Professional Headline
                      </label>
                      <input
                        type="text"
                        value={headline}
                        onChange={e => setHeadline(e.target.value)}
                        placeholder="e.g. Senior Staff Engineer at Google | Cloud Systems"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Current Designation
                        </label>
                        <input
                          type="text"
                          value={currentDesignation}
                          onChange={e => setCurrentDesignation(e.target.value)}
                          placeholder="e.g. Staff Software Engineer"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Company</label>
                        <input
                          type="text"
                          value={company}
                          onChange={e => setCompany(e.target.value)}
                          placeholder="e.g. Google"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Industry</label>
                        <input
                          type="text"
                          value={industry}
                          onChange={e => setIndustry(e.target.value)}
                          placeholder="e.g. Technology / Cloud Computing"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Years of Professional Experience
                        </label>
                        <input
                          type="number"
                          value={yearsOfExperience}
                          onChange={e => setYearsOfExperience(Number(e.target.value))}
                          min={0}
                          max={70}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Professional Biography & Career Journey
                      </label>
                      <textarea
                        rows={4}
                        value={alumniBio}
                        onChange={e => setAlumniBio(e.target.value)}
                        placeholder="Introduce yourself, your journey since university, and how you mentor students..."
                        className="w-full rounded-md border border-input bg-background p-3 text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" /> Skills, Expertise & Mentorship
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Separate multiple items with commas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Skills</label>
                      <input
                        type="text"
                        value={alumniSkillsStr}
                        onChange={e => setAlumniSkillsStr(e.target.value)}
                        placeholder="e.g. Distributed Systems, Kubernetes, Golang, High Scale"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Areas of Expertise
                      </label>
                      <input
                        type="text"
                        value={expertiseStr}
                        onChange={e => setExpertiseStr(e.target.value)}
                        placeholder="e.g. Backend Architecture, Engineering Management"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Available Mentorship Topics
                      </label>
                      <input
                        type="text"
                        value={mentorshipTopicsStr}
                        onChange={e => setMentorshipTopicsStr(e.target.value)}
                        placeholder="e.g. Career Transition, System Design Interviews"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Languages</label>
                        <input
                          type="text"
                          value={languagesStr}
                          onChange={e => setLanguagesStr(e.target.value)}
                          placeholder="e.g. English, Hindi"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Preferred Mentorship Mode
                        </label>
                        <select
                          value={alumniMode}
                          onChange={e => setAlumniMode(e.target.value as MentorshipMode)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="online">Online (Video/Audio)</option>
                          <option value="in-person">In-Person</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Visibility & Publication Controls */}
                <Card className="border-border/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" /> Profile Visibility & Status
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Controls whether eligible students can discover your professional profile and
                      mentorship offerings.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Draft Mode</p>
                        <p className="text-xs text-muted-foreground">
                          While in draft, your profile and offerings remain private to you.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isDraft}
                          onChange={e => setIsDraft(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Public Visibility</p>
                        <p className="text-xs text-muted-foreground">
                          Make profile discoverable to verified university community members.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isPubliclyVisible}
                          onChange={e => setIsPubliclyVisible(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    {!alumniProfile.isVerified && (
                      <div className="p-3 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                        <Lock className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>
                          Notice: Institutional verification is pending. You can edit and save your
                          draft profile, but public publication is locked until verification is
                          approved.
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button type="submit" isLoading={saving} className="gap-2">
                    <Save className="h-4 w-4" /> Save Professional Profile
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
