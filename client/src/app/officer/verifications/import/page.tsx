'use client';

/**
 * client/src/app/officer/verifications/import/page.tsx
 * Institutional Records CSV Import Page for Alumni Relations Officers and Admins.
 * Two-stage workflow:
 *  1. Preview Import (pure parsing, validation, no DB mutation)
 *  2. Confirm Import (audited idempotent bulk upsert into InstitutionalAlumniRecord)
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiPreviewCsvImport,
  apiConfirmCsvImport,
  ApiError,
  type CsvImportPreviewDTO,
  type CsvImportResultDTO,
  type ValidatedInstitutionalRecord,
  type RowValidationError,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/layout/container';
import { Spinner } from '@/components/ui/spinner';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Eye,
  ShieldCheck,
} from 'lucide-react';

const SAMPLE_CSV = `alumni_id,full_name,institutional_email,programme,department,graduation_year
ALU-2018-001,Priya Sharma,priya.sharma@alumni.univ.edu,B.Tech Computer Science,Computer Science & Engineering,2022
ALU-2019-042,Rohan Verma,rohan.verma@alumni.univ.edu,B.Tech Mechanical Engineering,Mechanical Engineering,2023
ALU-2020-108,Ananya Iyer,ananya.iyer@alumni.univ.edu,M.Tech Data Science,Computer Science & Engineering,2024`;

export default function OfficerCsvImportPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [copiedSnippet, setCopiedSnippet] = React.useState(false);

  // Preview & Confirm States
  const [isPreviewing, setIsPreviewing] = React.useState(false);
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [previewData, setPreviewData] = React.useState<CsvImportPreviewDTO | null>(null);
  const [importResult, setImportResult] = React.useState<CsvImportResultDTO | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // RBAC guard
  React.useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role !== 'alumni_officer' && user.role !== 'admin') {
        router.replace('/dashboard');
      }
    }
  }, [user, authLoading, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setPreviewData(null);
    setImportResult(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setErrorMessage('Please select a valid .csv file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 2 MB maximum limit.');
      return;
    }

    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setErrorMessage(null);
    setPreviewData(null);
    setImportResult(null);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setErrorMessage('Only .csv files are supported.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 2 MB maximum limit.');
      return;
    }

    setSelectedFile(file);
  };

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE_CSV);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) return;
    setIsPreviewing(true);
    setErrorMessage(null);
    setPreviewData(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const result = await apiPreviewCsvImport(formData);
      setPreviewData(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to preview CSV import. Check file formatting.');
      }
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedFile) return;
    setIsConfirming(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const result = await apiConfirmCsvImport(formData);
      setImportResult(result);
      setPreviewData(null);
      setSelectedFile(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to execute institutional record import.');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setImportResult(null);
    setErrorMessage(null);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!user || (user.role !== 'alumni_officer' && user.role !== 'admin')) {
    return null;
  }

  return (
    <div className="py-8 md:py-12 bg-muted/20 min-h-[calc(100vh-10rem)]">
      <Container size="wide">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back & Title Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <Link
                href="/officer/verifications"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Verification Queue
              </Link>
              <h1 className="text-2xl font-bold tracking-tight">Institutional Records CSV Import</h1>
              <p className="text-sm text-muted-foreground">
                Import authoritative university graduation rosters to power deterministic alumni verification.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 py-1 px-3 bg-card border-border/80">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Audited Operation
              </Badge>
            </div>
          </div>

          {/* Format Specification Banner */}
          <Card className="border-border/80 shadow-xs bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  Mandatory CSV Format Specification
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySnippet}
                  className="h-7 text-xs gap-1.5"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied Sample
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy Sample CSV
                    </>
                  )}
                </Button>
              </div>
              <CardDescription className="text-xs">
                Files must be UTF-8 encoded with headers in lowercase exact snake_case order:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="bg-muted/50 rounded-md p-3 border font-mono text-xs overflow-x-auto text-foreground">
                <code>alumni_id,full_name,institutional_email,programme,department,graduation_year</code>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Max 5,000 rows per file. Upserts are idempotent: identical records update details without unclaiming verified alumni.
              </p>
            </CardContent>
          </Card>

          {/* Success Result Banner */}
          {importResult && (
            <Card className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm">
              <CardContent className="py-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
                      Import Completed Successfully
                    </h2>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300">
                      The institutional records database has been updated and an append-only audit entry has been logged.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-card/80 p-3 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Total Processed</p>
                    <p className="text-xl font-bold">{importResult.totalProcessed}</p>
                  </div>
                  <div className="bg-card/80 p-3 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground uppercase font-medium">New Inserted</p>
                    <p className="text-xl font-bold text-emerald-600">{importResult.insertedCount}</p>
                  </div>
                  <div className="bg-card/80 p-3 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Updated</p>
                    <p className="text-xl font-bold text-blue-600">{importResult.updatedCount}</p>
                  </div>
                  <div className="bg-card/80 p-3 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Errors / Skipped</p>
                    <p className="text-xl font-bold text-muted-foreground">{importResult.skippedCount}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href="/officer/verifications">
                    <Button size="sm" className="gap-2">
                      <ShieldCheck className="h-4 w-4" /> Go to Verification Queue
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Import Another File
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* File Upload & Workflow Controls */}
          {!importResult && (
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Upload CSV File</CardTitle>
                <CardDescription className="text-xs">
                  Select or drag-and-drop a university graduation roster CSV file (max 2 MB).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border/80 hover:border-primary/50 bg-muted/10'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    {selectedFile ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB — Ready to preview
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          Drag and drop your roster CSV file here, or browse
                        </p>
                        <p className="text-xs text-muted-foreground">CSV format only, up to 2 MB</p>
                      </div>
                    )}

                    <div className="pt-2">
                      <label htmlFor="csv-file-input">
                        <input
                          id="csv-file-input"
                          type="file"
                          accept=".csv,text/csv"
                          onChange={handleFileChange}
                          className="sr-only"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('csv-file-input')?.click()}
                        >
                          {selectedFile ? 'Change File' : 'Select CSV File'}
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="flex items-start gap-2.5 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Action Controls */}
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={!selectedFile || isPreviewing || isConfirming}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handlePreview}
                    disabled={!selectedFile || isPreviewing || isConfirming}
                    isLoading={isPreviewing}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" /> Preview Import
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview Results & Confirmation Section */}
          {previewData && (
            <Card className="border-border/80 shadow-sm space-y-4">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Import Preview Summary
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Inspect parsed records and validation status before executing the database commit.
                    </CardDescription>
                  </div>
                  <Badge variant={previewData.validRowsCount > 0 ? 'default' : 'secondary'} className="self-start sm:self-auto">
                    {previewData.validRowsCount} Valid Records
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Total Rows</p>
                    <p className="text-xl font-bold">{previewData.totalRows}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Valid</p>
                    <p className="text-xl font-bold text-emerald-600">{previewData.validRowsCount}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Invalid</p>
                    <p className="text-xl font-bold text-destructive">{previewData.invalidRowsCount}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <p className="text-xs text-muted-foreground uppercase font-medium">File Duplicates</p>
                    <p className="text-xl font-bold text-amber-600">{previewData.duplicateRowsCount}</p>
                  </div>
                </div>

                {/* Validation Errors List */}
                {previewData.errors.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                      <XCircle className="h-4 w-4" /> Row Validation Issues ({previewData.errors.length})
                    </h3>
                    <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 max-h-48 overflow-y-auto space-y-1.5 text-xs">
                      {previewData.errors.slice(0, 10).map((err: RowValidationError, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-destructive">
                          <span className="font-semibold font-mono">Row {err.rowNumber}:</span>
                          <span>{err.reason}</span>
                        </div>
                      ))}
                      {previewData.errors.length > 10 && (
                        <p className="text-[11px] text-muted-foreground pt-1 italic">
                          ... and {previewData.errors.length - 10} more rows with errors.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Sample Records Table (First 10) */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Preview Sample (First {previewData.previewRecords.length} Rows)
                  </h3>
                  <div className="border rounded-md overflow-x-auto text-xs">
                    <table className="w-full divide-y">
                      <thead className="bg-muted/40 font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Alumni ID</th>
                          <th className="px-3 py-2 text-left">Full Name</th>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-left">Department</th>
                          <th className="px-3 py-2 text-left">Year</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {previewData.previewRecords.map((r: ValidatedInstitutionalRecord, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="px-3 py-2 font-mono font-medium">{r.alumniId}</td>
                            <td className="px-3 py-2">{r.fullName}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.institutionalEmail}</td>
                            <td className="px-3 py-2">{r.department}</td>
                            <td className="px-3 py-2">{r.graduationYear}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Confirm Action Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    {previewData.validRowsCount > 0 ? (
                      <span>
                        Confirming will upsert{' '}
                        <strong className="text-foreground">{previewData.validRowsCount}</strong> records into the
                        database.
                      </span>
                    ) : (
                      <span className="text-destructive font-medium">
                        No valid records found to import. Please review formatting.
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={handleReset} disabled={isConfirming}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleConfirm}
                      disabled={previewData.validRowsCount === 0 || isConfirming}
                      isLoading={isConfirming}
                      className="gap-2 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Confirm & Execute Import
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Container>
    </div>
  );
}
