'use client';

import * as React from 'react';
import Link from 'next/link';
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
import { GraduationCap, Lock, Mail, Info } from 'lucide-react';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Institutional email is required')
    .email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [submissionNotice, setSubmissionNotice] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (_data: LoginFormValues) => {
    setIsLoading(true);
    setSubmissionNotice(null);

    // Simulate standard asynchronous network validation
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsLoading(false);

    // Phase 1 scope: Do not fake successful authentication
    setSubmissionNotice(
      'Phase 1 Architecture Check: Client form validation succeeded. Backend JWT authentication & session cookies will be active upon module implementation in Phase 2.'
    );
  };

  return (
    <div className="py-12 md:py-20 bg-muted/20 min-h-[calc(100vh-10rem)] flex items-center">
      <Container size="narrow">
        <div className="mx-auto max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Sign In to Your Account
            </h1>
            <p className="text-sm text-muted-foreground">
              Access your mentorship dashboard, session schedule, and career goals
            </p>
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-lg">Portal Authentication</CardTitle>
              <CardDescription>Enter your registered credentials to sign in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {submissionNotice && (
                <Alert variant="info" className="text-xs">
                  <Info className="h-4 w-4" />
                  <AlertTitle className="text-xs font-semibold">System Notice</AlertTitle>
                  <AlertDescription className="text-xs mt-1 leading-relaxed">
                    {submissionNotice}
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email" required>
                    Email Address
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="student@university.edu or alumni@company.com"
                      hasError={!!errors.email}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      {...register('email')}
                    />
                    <Mail className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {errors.email && (
                    <p id="email-error" className="text-xs text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" required>
                      Password
                    </Label>
                    <span className="text-xs text-muted-foreground hover:underline cursor-pointer">
                      Forgot password?
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      hasError={!!errors.password}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                      {...register('password')}
                    />
                    <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {errors.password && (
                    <p id="password-error" className="text-xs text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  id="login-submit-button"
                  className="w-full mt-2"
                  isLoading={isLoading}
                >
                  Sign In
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3 pt-0 border-t mt-4 text-center">
              <p className="text-xs text-muted-foreground pt-4">
                Don&apos;t have an account yet?{' '}
                <Link
                  href="/register"
                  id="link-to-register"
                  className="font-medium text-primary hover:underline underline-offset-4"
                >
                  Register here
                </Link>
              </p>
              <div className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground text-center">
                Administrative and Placement Officer logins require university VPN authorization.
              </div>
            </CardFooter>
          </Card>
        </div>
      </Container>
    </div>
  );
}
