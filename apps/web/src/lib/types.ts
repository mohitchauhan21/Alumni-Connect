export type Role = 'student' | 'alumnus' | 'aro' | 'placement' | 'admin';

export interface Me {
  user: { id: string; name: string; email: string; phone: string | null; avatarUrl?: string | null; role: Role; timezone: string; notificationPrefs: { email: boolean; sms: boolean }; emailVerified: boolean; mfaEnabled: boolean };
  profile: { studentProfileId?: string | null; profileComplete?: boolean; alumnusId?: string | null; verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected' };
  security: {
    hasPassword: boolean;
    emailVerified: boolean;
    emailVerificationRequired: boolean;
    mfaEnabled: boolean;
    /** Staff accounts must use two-factor sign-in on this server. */
    mfaRequired: boolean;
    /** Required but not set up yet: the app shows the setup screen until it is. */
    mfaSetupRequired: boolean;
    recoveryCodesLeft: number | null;
  };
}

export interface Tag {
  id: string;
  name: string;
  category?: string;
}

export interface Capacity {
  maxMentees: number;
  activeCount: number;
  openSlots: number;
  paused: boolean;
  pausedUntil: string | null;
  accepting: boolean;
}

export interface Mentor {
  id: string;
  name: string;
  verified: boolean;
  headline: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  industry: string | null;
  yearsExperience: number | null;
  city: string | null;
  department: string | null;
  degree: string | null;
  graduationYear: number | null;
  bio: string | null;
  expertise: Tag[];
  mentoringAreas: string[];
  languages: string[];
  capacity?: Capacity;
  availability?: { id: string; dayOfWeek: number; startMinute: number; endMinute: number; timezone: string }[];
  match?: { score: number; reasons: string[]; breakdown?: Record<string, number> };
  /** Fee per session in rupees; 0 = free. Only charged when paid sessions are enabled. */
  sessionFee?: number;
}

export interface StudentCard {
  id: string;
  name: string;
  program: string | null;
  department: string | null;
  graduationYear: number | null;
  bio: string | null;
  interests: Tag[];
  targetRoles: string[];
  targetIndustries: string[];
  mentoringAreasWanted: string[];
  goals?: CareerGoal[];
}

export interface CareerGoal {
  id: string;
  title: string;
  description: string | null;
  targetRole: string | null;
  targetIndustry: string | null;
  timeframe: string;
  priority: number;
}

export interface MentorshipRequest {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
  message: string;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  declineReason: string | null;
  declineNote: string | null;
  matchScore: number | null;
  matchReasons: string[];
  goals?: CareerGoal[];
  mentor?: Mentor;
  student?: StudentCard;
}

export interface Mentorship {
  id: string;
  status: 'active' | 'completed' | 'ended';
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  health: 'healthy' | 'at_risk' | 'lapsed';
  healthScore: number;
  mentor: Mentor;
  student: StudentCard;
  viewerRole: 'student' | 'mentor' | 'staff';
  nextSessionAt?: string | null;
  /** The next meeting to join (participants only): soonest scheduled session that hasn't ended. */
  nextMeeting?: { id: string; title: string | null; scheduledStart: string | null; scheduledEnd: string | null; videoLink: string | null } | null;
  daysSinceActivity?: number;
  lastNudgedAt?: string | null;
}

export interface SessionT {
  id: string;
  status: 'proposed' | 'awaiting_payment' | 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  title: string;
  agenda: string | null;
  proposedBy: string;
  proposedSlots: { start: string; end: string }[];
  scheduledStart: string | null;
  scheduledEnd: string | null;
  videoLink: string | null;
  calendarSynced: boolean;
  summary: string | null;
  mentorPrivateNotes?: string | null;
  cancelReason: string | null;
  /** Price in paise, fixed when a slot was picked (0 = free). */
  fee: number;
  paymentDueAt: string | null;
  paid: boolean;
  paymentId: string | null;
  completedAt: string | null;
}

export interface Notice {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  actions: { label: string; href: string }[];
  readAt: string | null;
  createdAt: string;
}
