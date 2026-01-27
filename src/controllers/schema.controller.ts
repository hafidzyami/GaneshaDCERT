import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { SchemaService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";
import {
  CreateVCSchemaDTO,
  UpdateVCSchemaDTO,
  SchemaFilterDTO,
  SchemaByNameDTO,
} from "../dtos/schema.dto";

/**
 * VC Schema Controller
 *
 * RESPONSIBILITIES:
 * - Request validation
 * - DTO transformation
 * - Response formatting
 * - Error handling delegation
 */

// ============================================
// 🔹 GET ENDPOINTS (Database Only)
// ============================================

/**
 * Get all VC schemas with optional filters (from RDBMS)
 * @route GET /api/schemas
 */
export const getAllVCSchemas = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const filter: SchemaFilterDTO = {
      issuerDid: req.query.issuerDid as string | undefined,
      isActive:
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined,
      pricingOnly: req.query.pricingOnly === "true", // Default: false
    };

    const schemas = await SchemaService.getAllSchemas(filter);

    return ResponseHelper.success(res, {
      source: "rdbms",
      count: schemas.length,
      data: schemas,
    });
  }
);

/**
 * Get all VC schemas directly from blockchain with pagination
 * @route GET /api/schemas/blockchain?page=1&limit=100&latestOnly=true
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 100, max: 1000)
 * @query latestOnly - Return only latest versions (default: true)
 */
export const getAllVCSchemasFromBlockchain = asyncHandler(
  async (req: Request, res: Response) => {
    // Extract and validate query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const latestOnly = req.query.latestOnly !== 'false'; // default true

    const result = await SchemaService.getAllSchemasFromBlockchain(
      page,
      limit,
      latestOnly
    );

    return ResponseHelper.success(res, {
      source: "blockchain",
      data: result.schemas,
      pagination: result.pagination,
    });
  }
);

/**
 * Get total count of schemas from blockchain
 * @route GET /api/schemas/blockchain/count
 */
export const getSchemasCountFromBlockchain = asyncHandler(
  async (req: Request, res: Response) => {
    const count = await SchemaService.getSchemasCountFromBlockchain();

    return ResponseHelper.success(res, {
      source: "blockchain",
      count: count,
    });
  }
);

/**
 * Get specific schema version from blockchain
 * @route GET /api/schemas/blockchain/:id/version/:version
 */
export const getSchemaFromBlockchain = asyncHandler(
  async (req: Request, res: Response) => {
    const { id, version } = req.params;
    const versionNumber = parseInt(version);

    if (isNaN(versionNumber)) {
      throw new ValidationError("Version must be a valid number");
    }

    const schema = await SchemaService.getSchemaFromBlockchain(id, versionNumber);

    return ResponseHelper.success(res, {
      source: "blockchain",
      data: schema,
    });
  }
);

/**
 * Get latest schema version from blockchain
 * @route GET /api/schemas/blockchain/:id/latest
 */
export const getLatestSchemaFromBlockchain = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const schema = await SchemaService.getLatestSchemaFromBlockchain(id);

    return ResponseHelper.success(res, {
      source: "blockchain",
      data: schema,
    });
  }
);

/**
 * Get all versions of a schema by ID
 * @route GET /api/schemas/:id/versions
 */
export const getAllVersionsById = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id } = req.params;
    const schemas = await SchemaService.getAllVersionsById(id);

    return ResponseHelper.success(res, {
      count: schemas.length,
      data: schemas,
    });
  }
);

/**
 * Get schema by ID and Version (both required)
 * @route GET /api/schemas/:id/version/:version
 */
export const getSchemaByIdAndVersion = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id, version } = req.params;
    const versionNumber = parseInt(version);

    if (isNaN(versionNumber)) {
      throw new ValidationError("Version must be a valid number");
    }

    const schema = await SchemaService.getSchemaByIdAndVersion(
      id,
      versionNumber
    );

    return ResponseHelper.success(res, schema);
  }
);

/**
 * Get latest schema version by name and issuer
 * @route GET /api/schemas/latest
 */
export const getLatestSchemaVersion = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const params: SchemaByNameDTO = {
      name: req.query.name as string,
      issuerDid: req.query.issuerDid as string,
    };

    const schema = await SchemaService.getLatestVersion(params);

    return ResponseHelper.success(res, schema);
  }
);

/**
 * Get all versions of a schema
 * @route GET /api/schemas/versions
 */
export const getAllSchemaVersions = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const params: SchemaByNameDTO = {
      name: req.query.name as string,
      issuerDid: req.query.issuerDid as string,
    };

    const schemas = await SchemaService.getAllVersions(params);

    return ResponseHelper.success(res, {
      count: schemas.length,
      data: schemas,
    });
  }
);

/**
 * Check if schema version is active
 * @route GET /api/schemas/:id/version/:version/active
 */
export const isSchemaActive = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id, version } = req.params;
    const versionNumber = parseInt(version);

    if (isNaN(versionNumber)) {
      throw new ValidationError("Version must be a valid number");
    }

    const status = await SchemaService.isActive(id, versionNumber);

    return ResponseHelper.success(res, status);
  }
);

// ============================================
// 🔹 POST/PUT/PATCH/DELETE ENDPOINTS (Database + Blockchain)
// ============================================

/**
 * Create new VC schema
 * @route POST /api/schemas
 */
export const createVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const dto: CreateVCSchemaDTO = {
      name: req.body.name,
      schema: req.body.schema,
      issuer_did: req.body.issuer_did,
      expired_in: req.body.expired_in, // Extracted from schema object by middleware
    };

    // Get optional image file from multer
    const imageFile = req.file;
    const imageBuffer = imageFile?.buffer;
    const imageMimeType = imageFile?.mimetype;

    const result = await SchemaService.create(dto, imageBuffer, imageMimeType);

    return ResponseHelper.created(
      res,
      {
        schema: result.schema,
        transaction_hash: result.transaction_hash,
      },
      result.message
    );
  }
);

/**
 * Update VC schema (creates new version)
 * @route PUT /api/schemas/:id
 */
export const updateVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id } = req.params;
    const dto: UpdateVCSchemaDTO = {
      schema: req.body.schema,
      expired_in: req.body.expired_in, // Extracted from schema object by middleware
      image_link: req.body.image_link, // Optional: to keep existing background
    };

    // Get optional image file from multer
    const imageFile = req.file;
    const imageBuffer = imageFile?.buffer;
    const imageMimeType = imageFile?.mimetype;

    const result = await SchemaService.update(id, dto, imageBuffer, imageMimeType);

    return ResponseHelper.success(
      res,
      {
        schema: result.schema,
        transaction_hash: result.transaction_hash,
      },
      result.message
    );
  }
);

/**
 * Deactivate VC schema version
 * @route PATCH /api/schemas/:id/version/:version/deactivate
 */
export const deactivateVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id, version } = req.params;
    const versionNumber = parseInt(version);

    if (isNaN(versionNumber)) {
      throw new ValidationError("Version must be a valid number");
    }

    const result = await SchemaService.deactivate(id, versionNumber);

    return ResponseHelper.success(
      res,
      {
        schema: result.schema,
        transaction_hash: result.transaction_hash,
      },
      result.message
    );
  }
);

/**
 * Reactivate VC schema version
 * @route PATCH /api/schemas/:id/version/:version/reactivate
 */
export const reactivateVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id, version } = req.params;
    const versionNumber = parseInt(version);

    if (isNaN(versionNumber)) {
      throw new ValidationError("Version must be a valid number");
    }

    const result = await SchemaService.reactivate(id, versionNumber);

    return ResponseHelper.success(
      res,
      {
        schema: result.schema,
        transaction_hash: result.transaction_hash,
      },
      result.message
    );
  }
);

/**
 * Delete VC schema version (soft delete)
 * @route DELETE /api/schemas/:id/version/:version
 */
export const deleteVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id, version } = req.params;
    const versionNumber = parseInt(version);

    if (isNaN(versionNumber)) {
      throw new ValidationError("Version must be a valid number");
    }

    const result = await SchemaService.delete(id, versionNumber);

    return ResponseHelper.success(
      res,
      {
        transaction_hash: result.transaction_hash,
      },
      result.message
    );
  }
);

/**
 * Create VC schema price
 */
export const createVCSchemaPrice = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { schemaId, price, currency, issuerId, version} = req.body;

    const result = await SchemaService.createVCSchemaPrice({
      schemaId,
      price,
      currency,
      version,
    });

    return ResponseHelper.success(
      res,
      {
        schemaId,
        price,
        currency,
        issuerId,
      },
      result.message
    );
  }
);

/**
 * Update VC schema price
 */
export const updateVCSchemaPrice = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }
    const { schemaId, price, currency, version} = req.body;

    const result = await SchemaService.updateVCSchemaPrice({
      schemaId,
      price,
      currency,
      version,
    });

    return ResponseHelper.success(
      res,
      {
        schemaId,
        price,
        currency,
      },
      result.message
    );
  }
);

/**
 * Get all VC schema prices
 */
export const getAllVCSchemaPrices = asyncHandler(
  async (req: Request, res: Response) => {
    const prices = await SchemaService.getAllVCSchemaPrices();
    if (prices.length === 0) {
      return ResponseHelper.success(res, {
        count: 0,
        data: [],
      });
    }
    return ResponseHelper.success(res, {
      count: prices.length,
      data: prices,
    });
  }
);