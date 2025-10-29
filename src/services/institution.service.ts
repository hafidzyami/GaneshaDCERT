import { PrismaClient } from "@prisma/client";
import { prisma } from "../config/database";
import { NotFoundError, BadRequestError } from "../utils/errors/AppError";
import { GetInstitutionsQueryDTO, InstitutionListResponseDTO } from "../dtos";

/**
 * Institution Service
 * Handles institution-related operations
 */
class InstitutionService {
  private prisma: PrismaClient;

  /**
   * Constructor with dependency injection
   * @param dependencies - Optional dependencies for testing
   */
  constructor(dependencies?: { prisma?: PrismaClient }) {
    this.prisma = dependencies?.prisma || prisma;
  }

  /**
   * Create a new institution
   * This is called internally when registerDID is successful for institutional role
   */
  async createInstitution(data: {
    did: string;
    email: string;
    name: string;
    phone: string;
    country: string;
    website: string;
    address: string;
  }) {
    // Check if institution with DID already exists
    const existingByDID = await this.prisma.institution.findUnique({
      where: { did: data.did },
    });

    if (existingByDID) {
      throw new BadRequestError(
        `Institution with DID ${data.did} already exists`
      );
    }

    // Check if institution with email already exists
    const existingByEmail = await this.prisma.institution.findUnique({
      where: { email: data.email },
    });

    if (existingByEmail) {
      throw new BadRequestError(
        `Institution with email ${data.email} already exists`
      );
    }

    // Create new institution
    const institution = await this.prisma.institution.create({
      data: {
        did: data.did,
        email: data.email,
        name: data.name,
        phone: data.phone,
        country: data.country,
        website: data.website,
        address: data.address,
      },
    });

    return institution;
  }

  /**
   * Get all institutions with pagination and filtering
   */
  async getAllInstitutions(
    query: GetInstitutionsQueryDTO
  ): Promise<InstitutionListResponseDTO> {
    const {
      page = 1,
      limit = 10,
      search,
      country,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { did: { contains: search, mode: "insensitive" } },
      ];
    }

    if (country) {
      where.country = { equals: country, mode: "insensitive" };
    }

    // Get total count for pagination
    const total = await this.prisma.institution.count({ where });

    // Get institutions with pagination and sorting
    const institutions = await this.prisma.institution.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    return {
      institutions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get institution by DID
   */
  async getInstitutionByDID(did: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { did },
    });

    if (!institution) {
      throw new NotFoundError(`Institution with DID ${did} not found`);
    }

    return institution;
  }

  /**
   * Update institution by DID
   */
  async updateInstitution(
    did: string,
    data: {
      name?: string;
      phone?: string;
      country?: string;
      website?: string;
      address?: string;
    }
  ) {
    // Check if institution exists
    await this.getInstitutionByDID(did);

    // Update institution
    const updatedInstitution = await this.prisma.institution.update({
      where: { did },
      data,
    });

    return updatedInstitution;
  }

  /**
   * Delete institution by DID
   */
  async deleteInstitution(did: string) {
    // Check if institution exists
    await this.getInstitutionByDID(did);

    // Delete institution
    await this.prisma.institution.delete({
      where: { did },
    });

    return {
      message: "Institution deleted successfully",
      did,
    };
  }

  /**
   * Cleanup method to disconnect Prisma client
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

// Export singleton instance
const institutionServiceInstance = new InstitutionService();
export default institutionServiceInstance;

// Export class for testing
export { InstitutionService };
