/**
 * mentorship.types.ts
 * Types and DTOs for Mentorship Offerings and Discovery.
 */

import { MentorshipMode, PublicAlumniProfileDTO } from '../profile/profile.types.js';

export type OfferingStatus = 'draft' | 'active' | 'inactive';

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

export interface MentorshipOfferInput {
  title: string;
  description: string;
  topics: string[];
  targetAudience: string;
  mode: MentorshipMode;
  sessionDurationMinutes: number;
  maxMenteesCapacity: number;
  status?: OfferingStatus;
}

export interface MentorshipDiscoveryQuery {
  page?: number;
  limit?: number;
  search?: string;
  topic?: string;
  industry?: string;
  mode?: string;
}

export interface PaginatedMentorshipOffersDTO {
  items: MentorshipOfferDTO[];
  total: number;
  page: number;
  totalPages: number;
}
