'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Container } from '@/components/layout/container';
import { GraduationCap, ShieldAlert, CheckCircle2, Info } from 'lucide-react';

// Strict schema: Only 'student' and 'alumni' are permitted for public self-registration.
// Administrative, verification officer, and placement officer roles CANNOT be self-assigned.
const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(80, 'Full name must not exceed 80 characters'),
    email: z
      .string()
      .min(1, 'Email address is required')
      .email('Please enter a valid email address'),
    role: z.enum(['student', 'alumni'], {
      errorMap: () => ({ message: 'Please select a valid registration role' }),
    }),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
      .regex(/[0-9]/, 'Password must include at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

function RegisterFormContent() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'alumni' ? 'alumni' : 'student';

  const [submissionNotice, setSubmissionNotice] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      role: initialRole,
      password: '',
      confirmPassword: '',
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (_data: RegisterFormValues) => {
    setIsLoading(true);
    setSubmissionNotice(null);

    // Simulate standard asynchronous network validation
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsLoading(false);

    // Phase 1 scope notice
    setSubmissionNotice(
      'Phase 1 Architecture Check: Registration input validation succeeded with role-restricted permissions. Backend user persistence & institutional alumni verification pipelines will be connected in Phase 2.'
    );
  };

  return (
    <div className="py-12 md:py-16 bg-muted/20 min-h-[calc(100vh-10rem)] flex items-center">
      <Container size="narrow">
        <div className="mx-auto max-w-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Create Your Mentorship Account
            </h1>
            <p className="text-sm text-muted-foreground">
              Join the institutional network as an undergraduate or verified graduate
            </p>
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-lg">Account Registration</CardTitle>
              <CardDescription>
                Public registration is strictly permitted for Students and Alumni only
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {submissionNotice && (
                <Alert variant="info" className="text-xs">
                  <Info className="h-4 w-4" />
                  <AlertTitle className="text-xs font-semibold">Validation Notice</AlertTitle>
                  <AlertDescription className="text-xs mt-1 leading-relaxed">
                    {submissionNotice}
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                {/* Role Selection */}
                <div className="space-y-2">
                  <Label required>Select Your Role</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      id="role-btn-student"
                      onClick={() => setValue('role', 'student')}
                      className={`flex flex-col items-center justify-center rounded-lg border p-3.5 text-center transition-all cursor-pointer ${
                        selectedRole === 'student'
                          ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                          : 'border-input hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                      }`}
                    >
                      <span className="text-sm">Student</span>
                      <span className="text-[11px] opacity-80 mt-0.5">Seeking Career Guidance</span>
                    </button>

                    <button
                      type="button"
                      id="role-btn-alumni"
                      onClick={() => setValue('role', 'alumni')}
                      className={`flex flex-col items-center justify-center rounded-lg border p-3.5 text-center transition-all cursor-pointer ${
                        selectedRole === 'alumni'
                          ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                          : 'border-input hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                      }`}
                    >
                      <span className="text-sm">Alumni Mentor</span>
                      <span className="text-[11px] opacity-80 mt-0.5">Verified Graduate</span>
                    </button>
                  </div>
                  {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
                </div>

                {/* Role Privilege Disclaimer */}
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/60 text-xs text-muted-foreground border">
                  <ShieldAlert className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    Staff, Officers, and Admins are provisioned by Central IT and cannot
                    self-register.
                  </span>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" required>
                    Full Legal / University Name
                  </Label>
                  <Input
                    id="fullName"
                    placeholder="e.g. Alex Morgan"
                    hasError={!!errors.fullName}
                    aria-invalid={!!errors.fullName}
                    aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                    {...register('fullName')}
                  />
                  {errors.fullName && (
                    <p id="fullName-error" className="text-xs text-destructive">
                      {errors.fullName.message}
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div className="space-y-2">
                  <Label htmlFor="email" required>
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={
                      selectedRole === 'student'
                        ? 'student@university.edu'
                        : 'alumni@company.com or personal email'
                    }
                    hasError={!!errors.email}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    {...register('email')}
                  />
                  {errors.email && (
                    <p id="email-error" className="text-xs text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="password" required>
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      hasError={!!errors.password}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                      {...register('password')}
                    />
                    {errors.password && (
                      <p id="password-error" className="text-xs text-destructive">
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" required>
                      Confirm Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      hasError={!!errors.confirmPassword}
                      aria-invalid={!!errors.confirmPassword}
                      aria-describedby={
                        errors.confirmPassword ? 'confirmPassword-error' : undefined
                      }
                      {...register('confirmPassword')}
                    />
                    {errors.confirmPassword && (
                      <p id="confirmPassword-error" className="text-xs text-destructive">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground space-y-1">
                  <p className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Minimum 8 characters with
                    at least 1 uppercase letter and 1 number.
                  </p>
                </div>

                <Button
                  type="submit"
                  id="register-submit-button"
                  className="w-full mt-2"
                  isLoading={isLoading}
                >
                  Create Account
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex flex-col space-y-2 pt-0 border-t mt-4 text-center">
              <p className="text-xs text-muted-foreground pt-4">
                Already registered with the platform?{' '}
                <Link
                  href="/login"
                  id="link-to-login"
                  className="font-medium text-primary hover:underline underline-offset-4"
                >
                  Sign in here
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </Container>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <React.Suspense
      fallback={<div className="p-8 text-center">Loading registration portal...</div>}
    >
      <RegisterFormContent />
    </React.Suspense>
  );
}
