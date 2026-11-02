'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiGetMyVerification,
  apiSubmitVerification,
  ApiError,
  type AlumniVerificationDTO,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Container } from '@/components/layout/container';
import { Spinner } from '@/components/ui/spinner';
import {
  ShieldCheck,
  Clock,
  XCircle,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCcw,
  Building2,
  GraduationCap,
} from 'lucide-react';

const currentYear = new Date().getFullYear();

const submitSchema = z.object({
  alumniId: z
    .string()
    .min(1, 'Institutional Alumni ID / Roll No is required')
    .max(50, 'Alumni ID cannot exceed 50 characters')
    .trim(),
  institutionalEmail: z
    .string()
    .min(1, 'Institutional email is required')
    .email('Please enter a valid institutional email')
    .trim(),
  programme: z
    .string()
    .min(2, 'Programme must be at least 2 characters')
    .max(100, 'Programme cannot exceed 100 characters')
    .trim(),
  department: z
    .string()
    .min(2, 'Department must be at least 2 characters')
    .max(100, 'Department cannot exceed 100 characters')
    .trim(),
  graduationYear: z.coerce
    .number()
    .int('Graduation year must be an integer')
    .min(1950, 'Graduation year cannot be earlier than 1950')
    .max(currentYear + 1, `Graduation year cannot exceed ${currentYear + 1}`),
});

type FormValues = z.infer<typeof submitSchema>;

export default function VerificationPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [verification, setVerification] = React.useState<AlumniVerificationDTO | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [showResubmitForm, setShowResubmitForm] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(submitSchema),
    defaultValues: {
      alumniId: '',
      institutionalEmail: '',
      programme: '',
      department: '',
      graduationYear: currentYear,
    },
  });

  const loadVerification = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiGetMyVerification();
      setVerification(data);
      if (data) {
        reset({
          alumniId: data.alumniId,
          institutionalEmail: data.institutionalEmail,
          programme: data.programme,
          department: data.department,
          graduationYear: data.graduationYear,
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status !== 404) {
        setServerError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [reset]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role !== 'alumni') {
        router.replace('/dashboard');
      } else {
        loadVerification();
      }
    }
  }, [authLoading, user, router, loadVerification]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const updated = await apiSubmitVerification(values);
      setVerification(updated);
      setShowResubmitForm(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred while submitting verification details.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="py-10 md:py-16 bg-muted/20 min-h-[calc(100vh-10rem)]">
      <Container size="narrow">
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Institutional Credential Verification</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Alumni Verification Portal
            </h1>
            <p className="text-sm text-muted-foreground">
              Cross-reference your academic credentials against official institutional registries
            </p>
          </div>

          {serverError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Submission Error</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* STATE 1: VERIFIED */}
          {verification?.status === 'verified' && (
            <Card className="border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <CardTitle className="text-lg text-emerald-900 dark:text-emerald-100">
                        Identity Institutionally Verified
                      </CardTitle>
                      <CardDescription className="text-emerald-700 dark:text-emerald-300">
                        Accredited graduate record matched and approved by Alumni Relations
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                    Verified Mentor
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg bg-background/80 p-4 border text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                      Alumni ID
                    </span>
                    <span className="font-semibold">{verification.alumniId}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                      Institutional Email
                    </span>
                    <span className="font-semibold">{verification.institutionalEmail}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                      Programme
                    </span>
                    <span className="font-semibold">{verification.programme}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                      Department & Class
                    </span>
                    <span className="font-semibold">
                      {verification.department} (Class of {verification.graduationYear})
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your profile carries the verified institutional badge. Verification was approved
                  on{' '}
                  {verification.reviewedAt
                    ? new Date(verification.reviewedAt).toLocaleDateString()
                    : 'record'}.
                </p>
              </CardContent>
            </Card>
          )}

          {/* STATE 2: PENDING REVIEW */}
          {verification?.status === 'pending' && (
            <Card className="border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/20 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    <div>
                      <CardTitle className="text-lg text-amber-900 dark:text-amber-100">
                        Verification Request Pending Review
                      </CardTitle>
                      <CardDescription className="text-amber-700 dark:text-amber-300">
                        Submitted on {new Date(verification.submittedAt).toLocaleDateString()} (Version {verification.submissionVersion})
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Pending Review
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg bg-background/80 p-4 border text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                      Submitted Alumni ID
                    </span>
                    <span className="font-semibold">{verification.alumniId}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                      Institutional Email
                    </span>
                    <span className="font-semibold">{verification.institutionalEmail}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                      Programme & Department
                    </span>
                    <span className="font-semibold">
                      {verification.programme} — {verification.department}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                      Graduation Year
                    </span>
                    <span className="font-semibold">Class of {verification.graduationYear}</span>
                  </div>
                </div>

                <Alert variant="info" className="text-xs">
                  <FileText className="h-4 w-4" />
                  <AlertTitle className="font-semibold">Awaiting Officer Decision</AlertTitle>
                  <AlertDescription className="mt-1">
                    Your request is in the officer review queue. Once cross-referenced with the
                    university registry, your account will be updated automatically. Repeated
                    submissions are disabled while this request is pending.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* STATE 3: REJECTED (SHOW REASON + OPTIONAL RESUBMISSION FORM) */}
          {verification?.status === 'rejected' && !showResubmitForm && (
            <Card className="border-destructive/40 bg-destructive/5 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <XCircle className="h-6 w-6 text-destructive" />
                    <div>
                      <CardTitle className="text-lg text-destructive">
                        Verification Request Disapproved
                      </CardTitle>
                      <CardDescription>
                        Reviewed on{' '}
                        {verification.reviewedAt
                          ? new Date(verification.reviewedAt).toLocaleDateString()
                          : 'recent review'}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="destructive">Rejected</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/10 text-sm space-y-1">
                  <span className="text-xs font-semibold uppercase text-destructive tracking-wider block">
                    Officer Reason for Rejection:
                  </span>
                  <p className="text-foreground font-medium">
                    {verification.rejectionReason || 'Details could not be reconciled with registry.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground p-3 rounded-md bg-muted/40">
                  <div>Alumni ID: <strong className="text-foreground">{verification.alumniId}</strong></div>
                  <div>Email: <strong className="text-foreground">{verification.institutionalEmail}</strong></div>
                  <div>Programme: <strong className="text-foreground">{verification.programme}</strong></div>
                  <div>Year: <strong className="text-foreground">{verification.graduationYear}</strong></div>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Button
                  onClick={() => setShowResubmitForm(true)}
                  className="gap-2 w-full sm:w-auto"
                >
                  <RotateCcw className="h-4 w-4" />
                  Correct Details and Resubmit (v{verification.submissionVersion + 1})
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* STATE 4: SUBMISSION FORM (NOT SUBMITTED OR RESUBMITTING AFTER REJECTION) */}
          {(!verification || (verification.status === 'rejected' && showResubmitForm)) && (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {verification?.status === 'rejected'
                    ? `Resubmit Verification Details (Version ${verification.submissionVersion + 1})`
                    : 'Submit Institutional Academic Details'}
                </CardTitle>
                <CardDescription>
                  Enter the exact credentials recorded in your university degree and graduation registry
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="alumniId" required>
                      Institutional Alumni ID / Roll Number
                    </Label>
                    <Input
                      id="alumniId"
                      placeholder="e.g. ALM0001 or 2018-CS-042"
                      hasError={!!errors.alumniId}
                      {...register('alumniId')}
                    />
                    {errors.alumniId && (
                      <p className="text-xs text-destructive">{errors.alumniId.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="institutionalEmail" required>
                      Institutional or University Email
                    </Label>
                    <Input
                      id="institutionalEmail"
                      type="email"
                      placeholder="e.g. yourname@alumni.university.edu"
                      hasError={!!errors.institutionalEmail}
                      {...register('institutionalEmail')}
                    />
                    {errors.institutionalEmail && (
                      <p className="text-xs text-destructive">
                        {errors.institutionalEmail.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="programme" required>
                        Programme / Degree
                      </Label>
                      <Input
                        id="programme"
                        placeholder="e.g. BTech Computer Science"
                        hasError={!!errors.programme}
                        {...register('programme')}
                      />
                      {errors.programme && (
                        <p className="text-xs text-destructive">{errors.programme.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="department" required>
                        Department
                      </Label>
                      <Input
                        id="department"
                        placeholder="e.g. Computer Science & Engineering"
                        hasError={!!errors.department}
                        {...register('department')}
                      />
                      {errors.department && (
                        <p className="text-xs text-destructive">{errors.department.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="graduationYear" required>
                      Graduation Year
                    </Label>
                    <Input
                      id="graduationYear"
                      type="number"
                      placeholder={currentYear.toString()}
                      hasError={!!errors.graduationYear}
                      {...register('graduationYear')}
                    />
                    {errors.graduationYear && (
                      <p className="text-xs text-destructive">
                        {errors.graduationYear.message}
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-md bg-muted/60 text-xs text-muted-foreground flex items-start gap-2">
                    <GraduationCap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>
                      Our verification system deterministically cross-checks these fields against
                      official university archives. No scans or identity documents are required.
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      type="submit"
                      className="w-full sm:w-auto"
                      isLoading={isSubmitting}
                    >
                      {verification?.status === 'rejected'
                        ? 'Resubmit For Verification'
                        : 'Submit For Institutional Verification'}
                    </Button>
                    {verification?.status === 'rejected' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowResubmitForm(false)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </Container>
    </div>
  );
}

