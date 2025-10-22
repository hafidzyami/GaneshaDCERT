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
 * Get all VC schemas with optional filters
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
      activeOnly: req.query.activeOnly === "true",
    };

    const schemas = await SchemaService.getAllSchemas(filter);

    return ResponseHelper.success(res, {
      count: schemas.length,
      data: schemas,
    });
  }
);

/**
 * Get schema by ID
 * @route GET /api/schemas/:id
 */
export const getSchemaById = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id } = req.params;
    const schema = await SchemaService.getSchemaById(id);

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
 * Check if schema is active
 * @route GET /api/schemas/:id/active
 */
export const isSchemaActive = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id } = req.params;
    const status = await SchemaService.isActive(id);

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
    };

    const result = await SchemaService.create(dto);

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
    };

    const result = await SchemaService.update(id, dto);

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
 * Deactivate VC schema
 * @route PATCH /api/schemas/:id/deactivate
 */
export const deactivateVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id } = req.params;
    const result = await SchemaService.deactivate(id);

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
 * Reactivate VC schema
 * @route PATCH /api/schemas/:id/reactivate
 */
export const reactivateVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id } = req.params;
    const result = await SchemaService.reactivate(id);

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
 * Delete VC schema (soft delete)
 * @route DELETE /api/schemas/:id
 */
export const deleteVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id } = req.params;
    const result = await SchemaService.delete(id);

    return ResponseHelper.success(
      res,
      {
        transaction_hash: result.transaction_hash,
      },
      result.message
    );
  }
);
