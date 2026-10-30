import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/layout/container';
import {
  ShieldCheck,
  Compass,
  Target,
  Award,
  Users,
  Briefcase,
  CheckCircle,
  FileCheck2,
  Lock,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 md:gap-24 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 md:pt-20 pb-8 bg-gradient-to-b from-primary/5 via-background to-background">
        <Container size="wide">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Official Institutional Mentorship Network</span>
            </div>

            <h1
              id="main-heading"
              className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-foreground text-balance"
            >
              Verified Alumni Mentorship & Career Guidance
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed text-balance">
              Connecting university students with verified graduates across industries. Experience
              transparent matching, structured goal-oriented sessions, and authentic career
              insights.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/register?role=student"
                id="hero-btn-student"
                className="w-full sm:w-auto"
              >
                <Button size="lg" className="w-full sm:w-auto shadow-md">
                  Join as a Student
                </Button>
              </Link>
              <Link href="/register?role=alumni" id="hero-btn-alumni" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Register as an Alumni Mentor
                </Button>
              </Link>
            </div>

            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-600" /> Institutionally Verified Alumni
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-emerald-600" /> Privacy-First Architecture
              </span>
              <span className="flex items-center gap-1.5">
                <Target className="h-4 w-4 text-emerald-600" /> Explainable Matching Logic
              </span>
            </div>
          </div>
        </Container>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="scroll-mt-20">
        <Container size="wide">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
            <Badge variant="secondary">Workflow</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How the Mentorship Process Operates
            </h2>
            <p className="text-muted-foreground">
              A transparent, university-supervised lifecycle designed to ensure high-quality
              engagements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="relative overflow-hidden border-border/80 hover:shadow-md transition-shadow">
              <CardHeader className="space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-lg">
                  1
                </div>
                <CardTitle className="text-lg">Alumni Verification</CardTitle>
                <CardDescription>
                  Graduates register and their credentials are cross-checked against institutional
                  graduation records.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Verified records ensure students receive guidance from authentic, accredited
                graduates.
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-border/80 hover:shadow-md transition-shadow">
              <CardHeader className="space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-lg">
                  2
                </div>
                <CardTitle className="text-lg">Career Preferences</CardTitle>
                <CardDescription>
                  Students define target industry domains, technical interests, and specific
                  mentorship goals.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Mentors set availability slots and monthly mentee capacity limits to avoid burnout.
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-border/80 hover:shadow-md transition-shadow">
              <CardHeader className="space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-lg">
                  3
                </div>
                <CardTitle className="text-lg">Transparent Matching</CardTitle>
                <CardDescription>
                  A rule-based weighted algorithm evaluates mutual fit without unpredictable
                  black-box models.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Students review recommendations alongside clear explanations of why matches were
                suggested.
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-border/80 hover:shadow-md transition-shadow">
              <CardHeader className="space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-bold text-lg">
                  4
                </div>
                <CardTitle className="text-lg">Structured Sessions</CardTitle>
                <CardDescription>
                  Mentorship engagements proceed through formal scheduling, action items, and
                  structured feedback.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Sessions include calendar integration and milestone tracking to evaluate progress.
              </CardContent>
            </Card>
          </div>
        </Container>
      </section>

      {/* Platform Benefits Section */}
      <section id="benefits" className="scroll-mt-20 py-12 bg-muted/40 border-y">
        <Container size="wide">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
            <Badge variant="secondary">Value Proposition</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Engineered for the Entire Academic Community
            </h2>
            <p className="text-muted-foreground">
              Distinct role-specific capabilities tailored for students, alumni, and university
              administration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* For Students */}
            <Card className="bg-card">
              <CardHeader className="space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Compass className="h-5 w-5" />
                </div>
                <CardTitle>For Students</CardTitle>
                <CardDescription>
                  Direct access to accredited industry veterans who walked the same campus
                  corridors.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>Resume and interview guidance aligned with industry standards</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>Transparent matching criteria explaining why a mentor fits your goals</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>
                    Actionable goal tracking to turn discussions into tangible career progress
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* For Alumni Mentors */}
            <Card className="bg-card">
              <CardHeader className="space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Briefcase className="h-5 w-5" />
                </div>
                <CardTitle>For Alumni Mentors</CardTitle>
                <CardDescription>
                  Structured, respectful engagement that honors your professional time and
                  availability.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>
                    Strict capacity quotas to ensure mentorship fits your existing work schedule
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>
                    Privacy-preserving profiles that shield personal phone and direct email
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>
                    Opportunity to give back to your alma mater and identify emerging talent
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* For University Career Services */}
            <Card className="bg-card">
              <CardHeader className="space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Award className="h-5 w-5" />
                </div>
                <CardTitle>For Institutional Officers</CardTitle>
                <CardDescription>
                  Comprehensive oversight, audit logging, and engagement analytics for
                  accreditation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>
                    Administrative audit trail tracking every verification and role assignment
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>Placement Officer reporting dashboard for participation monitoring</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>Controlled verification workflows preventing unvetted external claims</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </Container>
      </section>

      {/* Verification Standards Section */}
      <section id="verification" className="scroll-mt-20">
        <Container size="wide">
          <div className="rounded-2xl border bg-card p-8 md:p-12 shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-3 py-1 text-xs font-semibold">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Institutional Integrity
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Rigorous Verification. Zero Counterfeit Profiles.
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Unlike open social networks where mentorship claims are unregulated, every alumni
                  mentor on the P11 platform is verified against university records by authorized
                  Alumni Relations Officers before appearing in search results.
                </p>
                <ul className="space-y-2 text-sm text-foreground/90">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>Cross-referenced graduation year, degree programme, and student ID</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>
                      Dual-tier approval: automated ERP/CSV matching and manual officer review
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>
                      Public registration strictly limited to standard student and alumni roles
                    </span>
                  </li>
                </ul>
              </div>

              <div className="bg-muted/50 rounded-xl p-6 border space-y-4">
                <h4 className="font-semibold text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Five-Tier Role-Based Security Model
                </h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="p-2.5 bg-background rounded-md border flex justify-between items-center">
                    <span className="font-medium text-foreground">1. Student</span>
                    <Badge variant="outline">Public Registration</Badge>
                  </div>
                  <div className="p-2.5 bg-background rounded-md border flex justify-between items-center">
                    <span className="font-medium text-foreground">2. Alumni / Mentor</span>
                    <Badge variant="outline">Verified by Officer</Badge>
                  </div>
                  <div className="p-2.5 bg-background rounded-md border flex justify-between items-center">
                    <span className="font-medium text-foreground">3. Alumni Relations Officer</span>
                    <Badge variant="secondary">Admin Provisioned</Badge>
                  </div>
                  <div className="p-2.5 bg-background rounded-md border flex justify-between items-center">
                    <span className="font-medium text-foreground">4. Placement Officer</span>
                    <Badge variant="secondary">Read-Only Analytics</Badge>
                  </div>
                  <div className="p-2.5 bg-background rounded-md border flex justify-between items-center">
                    <span className="font-medium text-foreground">5. Platform Administrator</span>
                    <Badge variant="destructive">Restricted Access</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Call to Action Banner */}
      <section className="bg-primary text-primary-foreground py-12 rounded-2xl mx-4 sm:mx-8 md:mx-16 text-center space-y-6">
        <Container size="narrow">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Start Your Mentorship Engagement Today
          </h2>
          <p className="text-primary-foreground/90 max-w-xl mx-auto leading-relaxed">
            Join thousands of university community members collaborating for career advancement,
            skill building, and professional networking.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto font-semibold">
                Create Your Account
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Log In to Portal
              </Button>
            </Link>
          </div>
        </Container>
      </section>
    </div>
  );
}
