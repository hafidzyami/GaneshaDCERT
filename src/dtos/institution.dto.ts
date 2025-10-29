/**
 * Institution DTOs
 */

export interface InstitutionDTO {
  id: string;
  did: string;
  email: string;
  name: string;
  phone: string;
  country: string;
  website: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetInstitutionsQueryDTO {
  page?: number;
  limit?: number;
  search?: string;
  country?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface InstitutionListResponseDTO {
  institutions: InstitutionDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
