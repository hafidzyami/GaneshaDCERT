import { DIDService } from "../did.service";
import { PrismaClient } from "@prisma/client";
import { BadRequestError, NotFoundError } from "../../utils/errors/AppError";

/**
 * Example Unit Tests for DID Service with Dependency Injection
 * This demonstrates how to use DI for testing
 */

// Mock Prisma Client
const mockPrismaClient = {
  institutionRegistration: {
    findUnique: jest.fn(),
  },
  $disconnect: jest.fn(),
} as unknown as PrismaClient;

// Mock Blockchain Service
const mockBlockchainService = {
  isDIDRegistered: jest.fn(),
  registerIndividualDID: jest.fn(),
  registerInstitutionalDID: jest.fn(),
  registerNewKey: jest.fn(),
  deactivateDID: jest.fn(),
  getDIDDocument: jest.fn(),
  getBlockNumber: jest.fn(),
};

describe("DIDService - registerDID", () => {
  let didService: DIDService;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create service instance with mocked dependencies
    didService = new DIDService({
      blockchainService: mockBlockchainService as any,
      prisma: mockPrismaClient,
    });
  });

  afterEach(async () => {
    // Cleanup
    await didService.disconnect();
  });

  describe("Individual DID Registration", () => {
    it("should register individual DID successfully", async () => {
      // Arrange
      const mockData = {
        did_string: "did:ganesha:0x123456789",
        public_key: "0xabc123",
        role: "individual",
      };

      const mockReceipt = {
        hash: "0xtxhash123",
        blockNumber: 12345,
      };

      mockBlockchainService.isDIDRegistered.mockResolvedValue(false);
      mockBlockchainService.registerIndividualDID.mockResolvedValue(
        mockReceipt
      );

      // Act
      const result = await didService.registerDID(mockData);

      // Assert
      expect(mockBlockchainService.isDIDRegistered).toHaveBeenCalledWith(
        mockData.did_string
      );
      expect(mockBlockchainService.registerIndividualDID).toHaveBeenCalledWith(
        mockData.did_string,
        mockData.public_key
      );
      expect(result).toEqual({
        message: "Individual DID registered successfully",
        did: mockData.did_string,
        transactionHash: mockReceipt.hash,
        blockNumber: mockReceipt.blockNumber,
      });
    });

    it("should throw error if DID already exists", async () => {
      // Arrange
      const mockData = {
        did_string: "did:ganesha:0x123456789",
        public_key: "0xabc123",
        role: "individual",
      };

      mockBlockchainService.isDIDRegistered.mockResolvedValue(true);

      // Act & Assert
      await expect(didService.registerDID(mockData)).rejects.toThrow(
        BadRequestError
      );
      await expect(didService.registerDID(mockData)).rejects.toThrow(
        "A DID Document already exists with this DID."
      );
    });
  });

  describe("Institution DID Registration", () => {
    it("should register institution DID successfully with approved status", async () => {
      // Arrange
      const mockData = {
        did_string: "did:ganesha:0x987654321",
        public_key: "0xdef456",
        role: "institution",
        email: "admin@university.edu",
      };

      const mockInstitution = {
        name: "Test University",
        phone: "+62-21-1234567",
        country: "Indonesia",
        website: "https://university.edu",
        address: "Jakarta, Indonesia",
        status: "APPROVED" as const,
      };

      const mockReceipt = {
        hash: "0xtxhash456",
        blockNumber: 67890,
      };

      mockBlockchainService.isDIDRegistered.mockResolvedValue(false);
      mockPrismaClient.institutionRegistration.findUnique = jest
        .fn()
        .mockResolvedValue(mockInstitution);
      mockBlockchainService.registerInstitutionalDID.mockResolvedValue(
        mockReceipt
      );

      // Act
      const result = await didService.registerDID(mockData);

      // Assert
      expect(mockBlockchainService.isDIDRegistered).toHaveBeenCalledWith(
        mockData.did_string
      );
      expect(
        mockPrismaClient.institutionRegistration.findUnique
      ).toHaveBeenCalledWith({
        where: { email: mockData.email },
        select: {
          name: true,
          phone: true,
          country: true,
          website: true,
          address: true,
          status: true,
        },
      });
      expect(
        mockBlockchainService.registerInstitutionalDID
      ).toHaveBeenCalledWith(
        mockData.did_string,
        mockData.public_key,
        mockData.email,
        mockInstitution.name,
        mockInstitution.phone,
        mockInstitution.country,
        mockInstitution.website,
        mockInstitution.address
      );
      expect(result).toEqual({
        message: "Institutional DID registered successfully",
        did: mockData.did_string,
        institution: {
          email: mockData.email,
          name: mockInstitution.name,
          phone: mockInstitution.phone,
          country: mockInstitution.country,
          website: mockInstitution.website,
          address: mockInstitution.address,
        },
        transactionHash: mockReceipt.hash,
        blockNumber: mockReceipt.blockNumber,
      });
    });

    it("should throw error if email is not provided for institution", async () => {
      // Arrange
      const mockData = {
        did_string: "did:ganesha:0x987654321",
        public_key: "0xdef456",
        role: "institution",
        // email is missing
      };

      mockBlockchainService.isDIDRegistered.mockResolvedValue(false);

      // Act & Assert
      await expect(didService.registerDID(mockData)).rejects.toThrow(
        BadRequestError
      );
      await expect(didService.registerDID(mockData)).rejects.toThrow(
        "Email is required for institution role"
      );
    });

    it("should throw error if institution not found in database", async () => {
      // Arrange
      const mockData = {
        did_string: "did:ganesha:0x987654321",
        public_key: "0xdef456",
        role: "institution",
        email: "nonexistent@university.edu",
      };

      mockBlockchainService.isDIDRegistered.mockResolvedValue(false);
      mockPrismaClient.institutionRegistration.findUnique = jest
        .fn()
        .mockResolvedValue(null);

      // Act & Assert
      await expect(didService.registerDID(mockData)).rejects.toThrow(
        NotFoundError
      );
      await expect(didService.registerDID(mockData)).rejects.toThrow(
        `Institution with email ${mockData.email} not found in registration database`
      );
    });

    it("should throw error if institution is not approved", async () => {
      // Arrange
      const mockData = {
        did_string: "did:ganesha:0x987654321",
        public_key: "0xdef456",
        role: "institution",
        email: "admin@university.edu",
      };

      const mockInstitution = {
        name: "Test University",
        phone: "+62-21-1234567",
        country: "Indonesia",
        website: "https://university.edu",
        address: "Jakarta, Indonesia",
        status: "PENDING" as const,
      };

      mockBlockchainService.isDIDRegistered.mockResolvedValue(false);
      mockPrismaClient.institutionRegistration.findUnique = jest
        .fn()
        .mockResolvedValue(mockInstitution);

      // Act & Assert
      await expect(didService.registerDID(mockData)).rejects.toThrow(
        BadRequestError
      );
      await expect(didService.registerDID(mockData)).rejects.toThrow(
        "Institution registration is not approved. Current status: PENDING"
      );
    });
  });
});

describe("DIDService - Other Methods", () => {
  let didService: DIDService;

  beforeEach(() => {
    jest.clearAllMocks();
    didService = new DIDService({
      blockchainService: mockBlockchainService as any,
      prisma: mockPrismaClient,
    });
  });

  afterEach(async () => {
    await didService.disconnect();
  });

  describe("checkDID", () => {
    it("should return DID info if exists", async () => {
      // Arrange
      const testDID = "did:ganesha:0x123456789";
      mockBlockchainService.isDIDRegistered.mockResolvedValue(true);

      // Act
      const result = await didService.checkDID(testDID);

      // Assert
      expect(result).toEqual({
        message: "DID exists",
        did: testDID,
        exists: true,
      });
    });

    it("should throw error if DID does not exist", async () => {
      // Arrange
      const testDID = "did:ganesha:0x123456789";
      mockBlockchainService.isDIDRegistered.mockResolvedValue(false);

      // Act & Assert
      await expect(didService.checkDID(testDID)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("rotateKey", () => {
    it("should rotate key successfully", async () => {
      // Arrange
      const testDID = "did:ganesha:0x123456789";
      const newPublicKey = "0xnewkey123";
      const mockReceipt = {
        hash: "0xtxhash789",
        blockNumber: 99999,
      };

      mockBlockchainService.isDIDRegistered.mockResolvedValue(true);
      mockBlockchainService.registerNewKey.mockResolvedValue(mockReceipt);

      // Act
      const result = await didService.rotateKey(testDID, newPublicKey);

      // Assert
      expect(mockBlockchainService.registerNewKey).toHaveBeenCalledWith(
        testDID,
        newPublicKey
      );
      expect(result).toEqual({
        message: "DID key rotated successfully",
        did: testDID,
        transactionHash: mockReceipt.hash,
        blockNumber: mockReceipt.blockNumber,
      });
    });

    it("should throw error if DID does not exist", async () => {
      // Arrange
      const testDID = "did:ganesha:0x123456789";
      const newPublicKey = "0xnewkey123";
      mockBlockchainService.isDIDRegistered.mockResolvedValue(false);

      // Act & Assert
      await expect(
        didService.rotateKey(testDID, newPublicKey)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deactivateDID", () => {
    it("should deactivate DID successfully", async () => {
      // Arrange
      const testDID = "did:ganesha:0x123456789";
      const mockReceipt = {
        hash: "0xtxhashdeactivate",
        blockNumber: 88888,
      };

      mockBlockchainService.isDIDRegistered.mockResolvedValue(true);
      mockBlockchainService.deactivateDID.mockResolvedValue(mockReceipt);

      // Act
      const result = await didService.deactivateDID(testDID);

      // Assert
      expect(mockBlockchainService.deactivateDID).toHaveBeenCalledWith(
        testDID
      );
      expect(result).toEqual({
        message: "DID deactivated successfully",
        did: testDID,
        transactionHash: mockReceipt.hash,
        blockNumber: mockReceipt.blockNumber,
      });
    });

    it("should throw error if DID does not exist", async () => {
      // Arrange
      const testDID = "did:ganesha:0x123456789";
      mockBlockchainService.isDIDRegistered.mockResolvedValue(false);

      // Act & Assert
      await expect(didService.deactivateDID(testDID)).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
