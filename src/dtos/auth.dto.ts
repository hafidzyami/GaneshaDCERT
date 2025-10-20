/**
 * Authentication DTOs
 */

export interface RegisterInstitutionDTO {
  name: string;
  email: string;
  phone: string;
  country: string;
  website: string;
  address: string;
}

export interface ApproveInstitutionDTO {
  institutionId: string;
  approvedBy: string;
}

export interface VerifyMagicLinkDTO {
  token: string;
}

export interface MagicLinkResponseDTO {
  sessionToken: string;
  institution: {
    id: string;
    name: string;
    email: string;
    phone: string;
    country: string;
    website: string;
    address: string;
  };
}
