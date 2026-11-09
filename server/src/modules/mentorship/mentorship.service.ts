/**
 * mentorship.service.ts
 * Domain logic for Mentorship Offering Management and Discovery.
 */

import { Types } from 'mongoose';
import { MentorshipOffer, IMentorshipOffer } from './mentorshipOffer.model.js';
import { User } from '../auth/user.model.js';
import { AlumniVerification } from '../verification/verification.model.js';
import { AlumniProfile } from '../profile/alumniProfile.model.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  MentorshipOfferDTO,
  MentorshipOfferInput,
  MentorshipDiscoveryQuery,
  PaginatedMentorshipOffersDTO,
} from './mentorship.types.js';

function toOfferDTO(doc: IMentorshipOffer, alumniData?: any): MentorshipOfferDTO {
  return {
    id: doc._id.toString(),
    alumniId: doc.alumniId.toString(),
    title: doc.title,
    description: doc.description,
    topics: doc.topics,
    targetAudience: doc.targetAudience,
    mode: doc.mode,
    sessionDurationMinutes: doc.sessionDurationMinutes,
    maxMenteesCapacity: doc.maxMenteesCapacity,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    ...(alumniData && { alumni: alumniData }),
  };
}

/**
 * Helper to verify alumnus is active and institutionally verified.
 */
async function assertActiveVerifiedAlumni(alumniId: string): Promise<void> {
  const alumniObjectId = new Types.ObjectId(alumniId);
  const [user, verification] = await Promise.all([
    User.findById(alumniObjectId),
    AlumniVerification.findOne({ userId: alumniObjectId, status: 'verified' }),
  ]);

  if (!user || user.role !== 'alumni') {
    throw new AppError('Only alumni can manage mentorship offerings.', 403, 'FORBIDDEN');
  }

  if (user.accountStatus !== 'active') {
    throw new AppError(
      'Inactive accounts cannot manage mentorship offerings.',
      403,
      'ACCOUNT_INACTIVE'
    );
  }

  if (!verification) {
    throw new AppError(
      'Only institutionally verified alumni can create or activate mentorship offerings.',
      403,
      'VERIFICATION_REQUIRED'
    );
  }
}

/**
 * Create a new mentorship offering.
 */
export async function createMentorshipOffer(
  alumniId: string,
  input: MentorshipOfferInput
): Promise<MentorshipOfferDTO> {
  await assertActiveVerifiedAlumni(alumniId);

  const offer = await MentorshipOffer.create({
    alumniId: new Types.ObjectId(alumniId),
    title: input.title.trim(),
    description: input.description.trim(),
    topics: input.topics.map(t => t.trim()),
    targetAudience: input.targetAudience.trim(),
    mode: input.mode,
    sessionDurationMinutes: input.sessionDurationMinutes,
    maxMenteesCapacity: input.maxMenteesCapacity,
    status: input.status || 'active',
  });

  return toOfferDTO(offer);
}

/**
 * List all offerings belonging to the authenticated alumnus.
 */
export async function getAlumniOwnOffers(alumniId: string): Promise<MentorshipOfferDTO[]> {
  const offers = await MentorshipOffer.find({
    alumniId: new Types.ObjectId(alumniId),
    isDeleted: false,
  }).sort({ createdAt: -1 });

  return offers.map(o => toOfferDTO(o));
}

/**
 * Retrieve details of a single mentorship offering.
 * Supports viewing own draft/inactive offers, but restricts other users to active, verified offers.
 */
export async function getMentorshipOfferById(
  offerId: string,
  viewerUserId?: string
): Promise<MentorshipOfferDTO> {
  const offer = await MentorshipOffer.findOne({
    _id: new Types.ObjectId(offerId),
    isDeleted: false,
  });

  if (!offer) {
    throw new AppError('Mentorship offering not found.', 404, 'NOT_FOUND');
  }

  const isOwner = viewerUserId && offer.alumniId.toString() === viewerUserId;

  // If not owner, verify offer and alumnus eligibility
  if (!isOwner) {
    if (offer.status !== 'active') {
      throw new AppError('Mentorship offering is currently inactive.', 404, 'OFFERING_INACTIVE');
    }

    const [user, verification, profile] = await Promise.all([
      User.findById(offer.alumniId),
      AlumniVerification.findOne({ userId: offer.alumniId, status: 'verified' }),
      AlumniProfile.findOne({ userId: offer.alumniId }),
    ]);

    if (!user || user.accountStatus !== 'active' || !verification) {
      throw new AppError('Mentorship offering is unavailable.', 404, 'OFFERING_UNAVAILABLE');
    }

    if (!profile || !profile.isPubliclyVisible || profile.isDraft) {
      throw new AppError('Alumni profile is private.', 404, 'OFFERING_UNAVAILABLE');
    }

    const publicAlumni = {
      id: profile._id.toString(),
      userId: user._id.toString(),
      fullName: user.fullName,
      programme: verification.programme,
      department: verification.department,
      graduationYear: verification.graduationYear,
      isVerified: true,
      headline: profile.headline,
      currentDesignation: profile.currentDesignation,
      company: profile.company,
      industry: profile.industry,
      yearsOfExperience: profile.yearsOfExperience,
      bio: profile.bio,
      skills: profile.skills,
      areasOfExpertise: profile.areasOfExpertise,
      mentorshipTopics: profile.mentorshipTopics,
      languages: profile.languages,
      preferredMentorshipMode: profile.preferredMentorshipMode,
    };

    return toOfferDTO(offer, publicAlumni);
  }

  return toOfferDTO(offer);
}

/**
 * Update an offering owned by the authenticated alumnus.
 */
export async function updateMentorshipOffer(
  offerId: string,
  alumniId: string,
  input: Partial<MentorshipOfferInput>
): Promise<MentorshipOfferDTO> {
  const offer = await MentorshipOffer.findOne({
    _id: new Types.ObjectId(offerId),
    isDeleted: false,
  });

  if (!offer) {
    throw new AppError('Mentorship offering not found.', 404, 'NOT_FOUND');
  }

  if (offer.alumniId.toString() !== alumniId) {
    throw new AppError('You do not have permission to modify this offering.', 403, 'FORBIDDEN');
  }

  // If setting to active, ensure alumnus is verified and active
  if (input.status === 'active') {
    await assertActiveVerifiedAlumni(alumniId);
  }

  if (input.title !== undefined) offer.title = input.title.trim();
  if (input.description !== undefined) offer.description = input.description.trim();
  if (input.topics !== undefined) offer.topics = input.topics.map(t => t.trim());
  if (input.targetAudience !== undefined) offer.targetAudience = input.targetAudience.trim();
  if (input.mode !== undefined) offer.mode = input.mode;
  if (input.sessionDurationMinutes !== undefined)
    offer.sessionDurationMinutes = input.sessionDurationMinutes;
  if (input.maxMenteesCapacity !== undefined) offer.maxMenteesCapacity = input.maxMenteesCapacity;
  if (input.status !== undefined) offer.status = input.status;

  await offer.save();
  return toOfferDTO(offer);
}

/**
 * Soft delete an offering owned by the authenticated alumnus.
 */
export async function deleteMentorshipOffer(offerId: string, alumniId: string): Promise<void> {
  const offer = await MentorshipOffer.findOne({
    _id: new Types.ObjectId(offerId),
    isDeleted: false,
  });

  if (!offer) {
    throw new AppError('Mentorship offering not found.', 404, 'NOT_FOUND');
  }

  if (offer.alumniId.toString() !== alumniId) {
    throw new AppError('You do not have permission to remove this offering.', 403, 'FORBIDDEN');
  }

  offer.isDeleted = true;
  offer.status = 'inactive';
  await offer.save();
}

/**
 * Browse active mentorship offerings published by verified alumni.
 * Supports keyword search across title, topics, target audience, and alumnus headline/industry.
 */
export async function discoverMentorshipOffers(
  query: MentorshipDiscoveryQuery
): Promise<PaginatedMentorshipOffersDTO> {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(50, Math.max(1, query.limit || 9));
  const skip = (page - 1) * limit;

  // 1. Resolve eligible alumni IDs: verified, active, and public
  const verifiedRecords = await AlumniVerification.find({ status: 'verified' })
    .select('userId')
    .lean();
  const verifiedUserIds = verifiedRecords.map(r => r.userId);

  const activeUsers = await User.find({
    _id: { $in: verifiedUserIds },
    role: 'alumni',
    accountStatus: 'active',
  })
    .select('_id fullName')
    .lean();
  const activeUserIds = activeUsers.map(u => u._id);

  // Filter by alumni profile visibility and optional industry filter
  const profileFilter: Record<string, unknown> = {
    userId: { $in: activeUserIds },
    isPubliclyVisible: true,
    isDraft: false,
  };

  if (query.industry && query.industry.trim().length > 0 && query.industry !== 'all') {
    profileFilter.industry = new RegExp(query.industry.trim(), 'i');
  }

  const eligibleProfiles = await AlumniProfile.find(profileFilter).lean();
  const eligibleAlumniIds = eligibleProfiles.map(p => p.userId);

  if (eligibleAlumniIds.length === 0) {
    return { items: [], total: 0, page, totalPages: 1 };
  }

  // 2. Build offer query
  const offerFilter: Record<string, unknown> = {
    alumniId: { $in: eligibleAlumniIds },
    status: 'active',
    isDeleted: false,
  };

  if (query.mode && query.mode !== 'all') {
    offerFilter.mode = query.mode;
  }

  if (query.topic && query.topic.trim().length > 0 && query.topic !== 'all') {
    offerFilter.topics = { $regex: new RegExp(query.topic.trim(), 'i') };
  }

  if (query.search && query.search.trim().length > 0) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    offerFilter.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { topics: searchRegex },
      { targetAudience: searchRegex },
    ];
  }

  const [rawOffers, total] = await Promise.all([
    MentorshipOffer.find(offerFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    MentorshipOffer.countDocuments(offerFilter),
  ]);

  // Map alumni profiles to offerings
  const alumniMap = new Map();
  for (const prof of eligibleProfiles) {
    const user = activeUsers.find(u => u._id.toString() === prof.userId.toString());
    if (user) {
      alumniMap.set(prof.userId.toString(), {
        id: prof._id.toString(),
        userId: user._id.toString(),
        fullName: user.fullName,
        headline: prof.headline,
        currentDesignation: prof.currentDesignation,
        company: prof.company,
        industry: prof.industry,
        yearsOfExperience: prof.yearsOfExperience,
        bio: prof.bio,
        skills: prof.skills,
        areasOfExpertise: prof.areasOfExpertise,
        mentorshipTopics: prof.mentorshipTopics,
        languages: prof.languages,
        preferredMentorshipMode: prof.preferredMentorshipMode,
        isVerified: true,
      });
    }
  }

  const items = rawOffers.map(doc => {
    const alumni = alumniMap.get(doc.alumniId.toString());
    return {
      id: doc._id.toString(),
      alumniId: doc.alumniId.toString(),
      title: doc.title,
      description: doc.description,
      topics: doc.topics,
      targetAudience: doc.targetAudience,
      mode: doc.mode,
      sessionDurationMinutes: doc.sessionDurationMinutes,
      maxMenteesCapacity: doc.maxMenteesCapacity,
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      ...(alumni && { alumni }),
    };
  });

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
