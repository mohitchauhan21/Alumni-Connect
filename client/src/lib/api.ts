/**
 * api.ts
 * Reusable API client for the P11 backend.
 * - Always includes credentials (sends HTTP-only cookie).
 * - Normalizes error responses.
 * - Never stores tokens in browser storage.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    status: number,
    code = 'API_ERROR',
    details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  // If not FormData, default to application/json
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include', // always send the HTTP-only auth cookie
    headers,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const error = json?.error;
    throw new ApiError(
      error?.message ?? 'An unexpected error occurred.',
      res.status,
      error?.code ?? 'API_ERROR',
      error?.details
    );
  }

  return json as T;
}

// ── Auth Types & Endpoints ─────────────────────────────────────────────────

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  role: 'student' | 'alumni' | 'alumni_officer' | 'placement_officer' | 'admin';
  accountStatus: 'active' | 'disabled' | 'suspended';
  createdAt: string;
}

interface AuthResponse {
  success: boolean;
  data: { user: PublicUser };
}

interface LogoutResponse {
  success: boolean;
  data: { message: string };
}

export async function apiRegister(payload: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'student' | 'alumni';
}): Promise<PublicUser> {
  const res = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data.user;
}

export async function apiLogin(payload: { email: string; password: string }): Promise<PublicUser> {
  const res = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data.user;
}

export async function apiLogout(): Promise<void> {
  await request<LogoutResponse>('/auth/logout', { method: 'POST' });
}

export async function apiGetMe(): Promise<PublicUser | null> {
  try {
    const res = await request<AuthResponse>('/auth/me');
    return res.data.user;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return null;
    }
    throw err;
  }
}

// ── Phase 3: Verification Types & Endpoints ────────────────────────────────

export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type MatchingResult = 'matched' | 'unmatched' | 'conflict';

export interface AlumniVerificationDTO {
  id: string;
  alumniId: string;
  institutionalEmail: string;
  programme: string;
  department: string;
  graduationYear: number;
  status: VerificationStatus;
  matchingResult: MatchingResult;
  submissionVersion: number;
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface MatchingDetails {
  matchedFields: string[];
  conflictingFields: string[];
  notes?: string;
}

export interface OfficerVerificationDetailDTO extends AlumniVerificationDTO {
  userId: string;
  applicantName: string;
  applicantAccountEmail: string;
  matchingDetails: MatchingDetails;
  matchedRecord?: {
    id: string;
    alumniId: string;
    fullName: string;
    institutionalEmail: string;
    programme: string;
    department: string;
    graduationYear: number;
  } | null;
  reviewedByOfficer?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface OfficerQueueItemDTO {
  id: string;
  userId: string;
  applicantName: string;
  applicantEmail: string;
  alumniId: string;
  programme: string;
  department: string;
  graduationYear: number;
  status: VerificationStatus;
  matchingResult: MatchingResult;
  submissionVersion: number;
  submittedAt: string;
  reviewedAt?: string;
}

export interface VerificationMetricsDTO {
  pendingCount: number;
  verifiedCount: number;
  rejectedCount: number;
  totalRecordsCount: number;
}

export interface ValidatedInstitutionalRecord {
  alumniId: string;
  fullName: string;
  institutionalEmail: string;
  programme: string;
  department: string;
  graduationYear: number;
}

export interface RowValidationError {
  rowNumber: number;
  alumniId?: string;
  reason: string;
}

export interface CsvImportPreviewDTO {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  duplicateRowsCount: number;
  existingConflictsCount: number;
  previewRecords: ValidatedInstitutionalRecord[];
  errors: RowValidationError[];
}

export interface CsvImportResultDTO {
  batchId: string;
  totalProcessed: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface VerificationSubmitInput {
  alumniId: string;
  institutionalEmail: string;
  programme: string;
  department: string;
  graduationYear: number;
}

export async function apiGetMyVerification(): Promise<AlumniVerificationDTO | null> {
  const res = await request<{
    success: boolean;
    data: { verification: AlumniVerificationDTO | null };
  }>('/verification/me');
  return res.data.verification;
}

export async function apiSubmitVerification(
  payload: VerificationSubmitInput
): Promise<AlumniVerificationDTO> {
  const res = await request<{
    success: boolean;
    data: { verification: AlumniVerificationDTO };
  }>('/verification/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data.verification;
}

export async function apiGetOfficerMetrics(): Promise<VerificationMetricsDTO> {
  const res = await request<{
    success: boolean;
    data: { metrics: VerificationMetricsDTO };
  }>('/verification/officer/metrics');
  return res.data.metrics;
}

export async function apiGetOfficerQueue(params: {
  page?: number;
  limit?: number;
  status?: string;
  matchingResult?: string;
  search?: string;
}): Promise<{ items: OfficerQueueItemDTO[]; total: number; page: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.matchingResult && params.matchingResult !== 'all')
    query.set('matchingResult', params.matchingResult);
  if (params.search) query.set('search', params.search);

  const res = await request<{
    success: boolean;
    data: { items: OfficerQueueItemDTO[]; total: number; page: number; totalPages: number };
  }>(`/verification/officer/queue?${query.toString()}`);
  return res.data;
}

export async function apiGetVerificationDetail(id: string): Promise<OfficerVerificationDetailDTO> {
  const res = await request<{
    success: boolean;
    data: { verification: OfficerVerificationDetailDTO };
  }>(`/verification/officer/${id}`);
  return res.data.verification;
}

export async function apiApproveVerification(id: string): Promise<AlumniVerificationDTO> {
  const res = await request<{
    success: boolean;
    data: { verification: AlumniVerificationDTO };
  }>(`/verification/officer/${id}/approve`, {
    method: 'POST',
  });
  return res.data.verification;
}

export async function apiRejectVerification(
  id: string,
  reason: string
): Promise<AlumniVerificationDTO> {
  const res = await request<{
    success: boolean;
    data: { verification: AlumniVerificationDTO };
  }>(`/verification/officer/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return res.data.verification;
}

export async function apiPreviewCsvImport(formData: FormData): Promise<CsvImportPreviewDTO> {
  const res = await request<{
    success: boolean;
    data: { preview: CsvImportPreviewDTO };
  }>('/verification/officer/records/import/preview', {
    method: 'POST',
    body: formData,
  });
  return res.data.preview;
}

export async function apiConfirmCsvImport(formData: FormData): Promise<CsvImportResultDTO> {
  const res = await request<{
    success: boolean;
    data: { result: CsvImportResultDTO };
  }>('/verification/officer/records/import', {
    method: 'POST',
    body: formData,
  });
  return res.data.result;
}

// ── Phase 4: Profile & Mentorship Types & APIs ──────────────────────────────

export type MentorshipMode = 'online' | 'in-person' | 'hybrid';
export type OfferingStatus = 'draft' | 'active' | 'inactive';

export interface StudentProfileDTO {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  programme: string;
  department: string;
  graduationYear: number;
  academicInterests: string[];
  skills: string[];
  careerInterests: string[];
  careerGoals: string;
  preferredMentorshipTopics: string[];
  preferredMentorshipMode: MentorshipMode;
  bio: string;
  completionPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlumniProfileDTO {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  alumniId?: string;
  institutionalEmail?: string;
  programme?: string;
  department?: string;
  graduationYear?: number;
  isVerified: boolean;
  headline: string;
  currentDesignation: string;
  company: string;
  industry: string;
  yearsOfExperience: number;
  bio: string;
  skills: string[];
  areasOfExpertise: string[];
  mentorshipTopics: string[];
  languages: string[];
  preferredMentorshipMode: MentorshipMode;
  isPubliclyVisible: boolean;
  isDraft: boolean;
  completionPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAlumniProfileDTO {
  id: string;
  userId: string;
  fullName: string;
  programme: string;
  department: string;
  graduationYear: number;
  isVerified: boolean;
  headline: string;
  currentDesignation: string;
  company: string;
  industry: string;
  yearsOfExperience: number;
  bio: string;
  skills: string[];
  areasOfExpertise: string[];
  mentorshipTopics: string[];
  languages: string[];
  preferredMentorshipMode: MentorshipMode;
}

export interface MentorshipOfferDTO {
  id: string;
  alumniId: string;
  title: string;
  description: string;
  topics: string[];
  targetAudience: string;
  mode: MentorshipMode;
  sessionDurationMinutes: number;
  maxMenteesCapacity: number;
  status: OfferingStatus;
  createdAt: string;
  updatedAt: string;
  alumni?: PublicAlumniProfileDTO;
}

export interface PaginatedMentorshipOffersDTO {
  items: MentorshipOfferDTO[];
  total: number;
  page: number;
  totalPages: number;
}

export async function apiGetMyProfile(): Promise<
  | { role: 'student'; profile: StudentProfileDTO }
  | { role: 'alumni'; profile: AlumniProfileDTO }
  | { role: string; profile: any }
> {
  const res = await request<{
    success: boolean;
    data:
      | { role: 'student'; profile: StudentProfileDTO }
      | { role: 'alumni'; profile: AlumniProfileDTO }
      | { role: string; profile: any };
  }>('/profiles/me');
  return res.data;
}

export async function apiUpdateMyProfile(
  data: any
): Promise<
  | { role: 'student'; profile: StudentProfileDTO }
  | { role: 'alumni'; profile: AlumniProfileDTO }
  | { role: string; profile: any }
> {
  const res = await request<{
    success: boolean;
    data:
      | { role: 'student'; profile: StudentProfileDTO }
      | { role: 'alumni'; profile: AlumniProfileDTO }
      | { role: string; profile: any };
  }>('/profiles/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function apiGetPublicAlumniProfile(userId: string): Promise<PublicAlumniProfileDTO> {
  const res = await request<{
    success: boolean;
    data: { profile: PublicAlumniProfileDTO };
  }>(`/profiles/alumni/${userId}`);
  return res.data.profile;
}

export async function apiCreateMentorshipOffer(data: {
  title: string;
  description: string;
  topics: string[];
  targetAudience: string;
  mode: MentorshipMode;
  sessionDurationMinutes: number;
  maxMenteesCapacity: number;
  status?: OfferingStatus;
}): Promise<MentorshipOfferDTO> {
  const res = await request<{
    success: boolean;
    data: { offer: MentorshipOfferDTO };
  }>('/mentorship/offers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data.offer;
}

export async function apiGetMyMentorshipOffers(): Promise<MentorshipOfferDTO[]> {
  const res = await request<{
    success: boolean;
    data: { offers: MentorshipOfferDTO[] };
  }>('/mentorship/offers/mine');
  return res.data.offers;
}

export async function apiGetMentorshipOffer(id: string): Promise<MentorshipOfferDTO> {
  const res = await request<{
    success: boolean;
    data: { offer: MentorshipOfferDTO };
  }>(`/mentorship/offers/${id}`);
  return res.data.offer;
}

export async function apiUpdateMentorshipOffer(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    topics: string[];
    targetAudience: string;
    mode: MentorshipMode;
    sessionDurationMinutes: number;
    maxMenteesCapacity: number;
    status: OfferingStatus;
  }>
): Promise<MentorshipOfferDTO> {
  const res = await request<{
    success: boolean;
    data: { offer: MentorshipOfferDTO };
  }>(`/mentorship/offers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data.offer;
}

export async function apiDeleteMentorshipOffer(id: string): Promise<void> {
  await request<{
    success: boolean;
    data: { message: string };
  }>(`/mentorship/offers/${id}`, {
    method: 'DELETE',
  });
}

export async function apiDiscoverMentorshipOffers(query: {
  page?: number;
  limit?: number;
  search?: string;
  topic?: string;
  industry?: string;
  mode?: string;
}): Promise<PaginatedMentorshipOffersDTO> {
  const searchParams = new URLSearchParams();
  if (query.page) searchParams.set('page', query.page.toString());
  if (query.limit) searchParams.set('limit', query.limit.toString());
  if (query.search) searchParams.set('search', query.search);
  if (query.topic && query.topic !== 'all') searchParams.set('topic', query.topic);
  if (query.industry && query.industry !== 'all') searchParams.set('industry', query.industry);
  if (query.mode && query.mode !== 'all') searchParams.set('mode', query.mode);

  const res = await request<{
    success: boolean;
    data: PaginatedMentorshipOffersDTO;
  }>(`/mentorship/offers?${searchParams.toString()}`);
  return res.data;
}
