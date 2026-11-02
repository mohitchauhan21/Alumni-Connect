'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiGetOfficerMetrics,
  apiGetOfficerQueue,
  apiGetVerificationDetail,
  apiApproveVerification,
  apiRejectVerification,
  ApiError,
  type VerificationMetricsDTO,
  type OfficerQueueItemDTO,
  type OfficerVerificationDetailDTO,
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
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  X,
  Eye,
  AlertCircle,
  Database,
} from 'lucide-react';

export default function OfficerVerificationPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Metrics state
  const [metrics, setMetrics] = React.useState<VerificationMetricsDTO | null>(null);
  const [metricsLoading, setMetricsLoading] = React.useState(true);

  // Queue state
  const [queue, setQueue] = React.useState<OfficerQueueItemDTO[]>([]);
  const [queueLoading, setQueueLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [matchFilter, setMatchFilter] = React.useState('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  // Review modal state
  const [selectedVerification, setSelectedVerification] =
    React.useState<OfficerVerificationDetailDTO | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Rejection modal
  const [rejecting, setRejecting] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');

  const isOfficer = user?.role === 'alumni_officer' || user?.role === 'admin';

  // Load metrics
  const loadMetrics = React.useCallback(async () => {
    try {
      setMetricsLoading(true);
      const data = await apiGetOfficerMetrics();
      setMetrics(data);
    } catch {
      // Degraded metrics
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Load queue
  const loadQueue = React.useCallback(async () => {
    try {
      setQueueLoading(true);
      const res = await apiGetOfficerQueue({
        page,
        limit: 10,
        status: statusFilter,
        matchingResult: matchFilter,
        search: searchTerm,
      });
      setQueue(res.items);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
    } catch {
      setQueue([]);
    } finally {
      setQueueLoading(false);
    }
  }, [page, statusFilter, matchFilter, searchTerm]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else if (!isOfficer) {
        router.replace('/dashboard');
      } else {
        loadMetrics();
      }
    }
  }, [authLoading, user, isOfficer, router, loadMetrics]);

  React.useEffect(() => {
    if (isOfficer) {
      loadQueue();
    }
  }, [isOfficer, loadQueue]);

  // Open detail modal
  const openDetail = async (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    setRejecting(false);
    setRejectReason('');
    try {
      const detail = await apiGetVerificationDetail(id);
      setSelectedVerification(detail);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      }
    }
  };

  // Approve action
  const handleApprove = async () => {
    if (!selectedVerification) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await apiApproveVerification(selectedVerification.id);
      setActionSuccess(`Successfully verified ${selectedVerification.applicantName}!`);
      setSelectedVerification(null);
      loadMetrics();
      loadQueue();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Approval failed.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Reject action
  const handleReject = async () => {
    if (!selectedVerification) return;
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      setActionError('Please specify a rejection reason (minimum 5 characters).');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await apiRejectVerification(selectedVerification.id, rejectReason.trim());
      setActionSuccess(`Verification for ${selectedVerification.applicantName} was rejected.`);
      setSelectedVerification(null);
      setRejecting(false);
      setRejectReason('');
      loadMetrics();
      loadQueue();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Rejection failed.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || (!isOfficer && user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="py-10 md:py-14 bg-muted/20 min-h-[calc(100vh-10rem)]">
      <Container size="wide">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Officer Credential Governance</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Alumni Verification Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Review applicant credential requests against official institutional records
              </p>
            </div>
            <Link href="/officer/verifications/import">
              <Button className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Import University CSV Records
              </Button>
            </Link>
          </div>

          {actionSuccess && (
            <Alert variant="default" className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle className="text-emerald-900 dark:text-emerald-100">Operation Successful</AlertTitle>
              <AlertDescription className="text-emerald-800 dark:text-emerald-200">{actionSuccess}</AlertDescription>
            </Alert>
          )}

          {actionError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Action Error</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          {/* Overview Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Pending Queue
                  </p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {metricsLoading ? '—' : metrics?.pendingCount ?? 0}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-amber-500/40" />
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Verified
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {metricsLoading ? '—' : metrics?.verifiedCount ?? 0}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500/40" />
              </CardContent>
            </Card>

            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Rejected
                  </p>
                  <p className="text-2xl font-bold text-destructive">
                    {metricsLoading ? '—' : metrics?.rejectedCount ?? 0}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-destructive/40" />
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Registry Records
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {metricsLoading ? '—' : metrics?.totalRecordsCount ?? 0}
                  </p>
                </div>
                <Database className="h-8 w-8 text-primary/40" />
              </CardContent>
            </Card>
          </div>

          {/* Queue & Filtering */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Verification Queue</CardTitle>
                  <CardDescription>
                    {totalCount} total request(s) found
                  </CardDescription>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48 sm:w-64">
                    <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search ID, email, dept..."
                      className="pl-8 text-xs h-9"
                      value={searchTerm}
                      onChange={e => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>

                  <select
                    className="h-9 px-2.5 text-xs rounded-md border border-input bg-background"
                    value={statusFilter}
                    onChange={e => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <select
                    className="h-9 px-2.5 text-xs rounded-md border border-input bg-background"
                    value={matchFilter}
                    onChange={e => {
                      setMatchFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">All Match Results</option>
                    <option value="matched">Matched</option>
                    <option value="conflict">Conflict</option>
                    <option value="unmatched">Unmatched</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {queueLoading ? (
                <div className="py-16 text-center">
                  <Spinner className="h-7 w-7 text-primary mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Loading queue records...</p>
                </div>
              ) : queue.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-medium">No verification requests found</p>
                  <p className="text-xs">Adjust your search filters or import official records.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-3 px-4">Applicant</th>
                        <th className="py-3 px-4">Alumni ID</th>
                        <th className="py-3 px-4">Programme & Dept</th>
                        <th className="py-3 px-4">Grad Year</th>
                        <th className="py-3 px-4">Registry Match</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Submitted</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {queue.map(item => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-medium">
                            <div>{item.applicantName}</div>
                            <div className="text-[11px] text-muted-foreground">{item.applicantEmail}</div>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-foreground">
                            {item.alumniId}
                          </td>
                          <td className="py-3 px-4">
                            <div>{item.programme}</div>
                            <div className="text-[11px] text-muted-foreground">{item.department}</div>
                          </td>
                          <td className="py-3 px-4">{item.graduationYear}</td>
                          <td className="py-3 px-4">
                            {item.matchingResult === 'matched' && (
                              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-[11px]">
                                Matched
                              </Badge>
                            )}
                            {item.matchingResult === 'conflict' && (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-900 text-[11px]">
                                Conflict
                              </Badge>
                            )}
                            {item.matchingResult === 'unmatched' && (
                              <Badge variant="outline" className="text-muted-foreground text-[11px]">
                                Unmatched
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                item.status === 'verified'
                                  ? 'default'
                                  : item.status === 'rejected'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                              className="capitalize text-[11px]"
                            >
                              {item.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(item.submittedAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 h-8 text-xs"
                              onClick={() => openDetail(item.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Review
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>

            {/* Pagination */}
            {totalPages > 1 && (
              <CardFooter className="py-3 px-4 border-t flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>

          {/* DETAIL & REVIEW MODAL */}
          {selectedVerification && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-background rounded-xl border max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-lg font-bold">Verification Review</h2>
                    <p className="text-xs text-muted-foreground">
                      Request ID: {selectedVerification.id} (Version {selectedVerification.submissionVersion})
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedVerification(null)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Match Status Banner */}
                <div
                  className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
                    selectedVerification.matchingResult === 'matched'
                      ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100'
                      : selectedVerification.matchingResult === 'conflict'
                        ? 'border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100'
                        : 'border-muted bg-muted/30 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {selectedVerification.matchingResult === 'matched' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : selectedVerification.matchingResult === 'conflict' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-semibold uppercase tracking-wider">
                      Registry Evaluation: {selectedVerification.matchingResult}
                    </span>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    Status: {selectedVerification.status}
                  </Badge>
                </div>

                {selectedVerification.matchingDetails.notes && (
                  <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md">
                    {selectedVerification.matchingDetails.notes}
                  </p>
                )}

                {/* Side-by-side comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Applicant Submitted */}
                  <div className="border rounded-lg p-3.5 space-y-2 bg-muted/20">
                    <span className="font-semibold uppercase text-muted-foreground tracking-wider block">
                      Applicant Submission
                    </span>
                    <div>Name: <strong className="text-foreground">{selectedVerification.applicantName}</strong></div>
                    <div>Account Email: <span className="text-foreground">{selectedVerification.applicantAccountEmail}</span></div>
                    <div>Alumni ID: <strong className="text-foreground font-mono">{selectedVerification.alumniId}</strong></div>
                    <div>Inst Email: <span className="text-foreground">{selectedVerification.institutionalEmail}</span></div>
                    <div>Programme: <span className="text-foreground">{selectedVerification.programme}</span></div>
                    <div>Dept: <span className="text-foreground">{selectedVerification.department}</span></div>
                    <div>Grad Year: <span className="text-foreground">{selectedVerification.graduationYear}</span></div>
                  </div>

                  {/* Official Record */}
                  <div className="border rounded-lg p-3.5 space-y-2 bg-muted/20">
                    <span className="font-semibold uppercase text-muted-foreground tracking-wider block">
                      Official University Registry
                    </span>
                    {selectedVerification.matchedRecord ? (
                      <>
                        <div>Name: <strong className="text-foreground">{selectedVerification.matchedRecord.fullName}</strong></div>
                        <div>Alumni ID: <strong className="text-foreground font-mono">{selectedVerification.matchedRecord.alumniId}</strong></div>
                        <div>Inst Email: <span className="text-foreground">{selectedVerification.matchedRecord.institutionalEmail}</span></div>
                        <div>Programme: <span className="text-foreground">{selectedVerification.matchedRecord.programme}</span></div>
                        <div>Dept: <span className="text-foreground">{selectedVerification.matchedRecord.department}</span></div>
                        <div>Grad Year: <span className="text-foreground">{selectedVerification.matchedRecord.graduationYear}</span></div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">
                        No corresponding record found in institutional dataset for ID &quot;{selectedVerification.alumniId}&quot;.
                      </div>
                    )}
                  </div>
                </div>

                {/* Rejection reason box */}
                {rejecting && (
                  <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
                    <Label htmlFor="rejectReason" required className="text-xs text-destructive font-semibold">
                      Reason for Disapproval (Mandatory)
                    </Label>
                    <textarea
                      id="rejectReason"
                      rows={3}
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="e.g. Graduation year does not match institutional registry records; please verify."
                      className="w-full text-xs p-2.5 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-destructive"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRejecting(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleReject}
                        isLoading={actionLoading}
                      >
                        Confirm Rejection
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!rejecting && (
                  <div className="flex items-center justify-between pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedVerification(null)}
                    >
                      Close
                    </Button>

                    {selectedVerification.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setRejecting(true)}
                        >
                          Reject Request...
                        </Button>

                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                          disabled={selectedVerification.matchingResult !== 'matched'}
                          onClick={handleApprove}
                          isLoading={actionLoading}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve Verification
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}

