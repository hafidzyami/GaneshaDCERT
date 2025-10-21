import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { SchemaService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";

/**
 * Get All VC Schemas Controller
 * Query from database only (fast)
 */
export const getAllVCSchemas = asyncHandler(
  async (req: Request, res: Response) => {
    const { issuerDid, activeOnly } = req.query;

    const schemas = await SchemaService.getAllVCSchemas(
      issuerDid as string | undefined,
      activeOnly === "true"
    );

    res.status(200).json({
      success: true,
      count: schemas.length,
      data: schemas,
    });
  }
);

/**
 * Get Schema by ID Controller
 * Query from database only
 */
export const getSchemaById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const schema = await SchemaService.getSchemaById(id);

    res.status(200).json({
      success: true,
      data: schema,
    });
  }
);

/**
 * Get Latest Schema Version Controller
 * Get latest version by schema name and issuer
 */
export const getLatestSchemaVersion = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, issuerDid } = req.query;

    if (!name || !issuerDid) {
      throw new ValidationError("Name and issuerDid are required", []);
    }

    const schema = await SchemaService.getLatestSchemaVersion(
      name as string,
      issuerDid as string
    );

    res.status(200).json({
      success: true,
      data: schema,
    });
  }
);

/**
 * Get All Schema Versions Controller
 * Get all versions of a schema by name and issuer
 */
export const getAllSchemaVersions = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, issuerDid } = req.query;

    if (!name || !issuerDid) {
      throw new ValidationError("Name and issuerDid are required", []);
    }

    const schemas = await SchemaService.getAllSchemaVersions(
      name as string,
      issuerDid as string
    );

    res.status(200).json({
      success: true,
      count: schemas.length,
      data: schemas,
    });
  }
);

/**
 * Check if Schema is Active Controller
 */
export const isSchemaActive = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const isActive = await SchemaService.isSchemaActive(id);

    res.status(200).json({
      success: true,
      data: {
        id,
        isActive,
      },
    });
  }
);

/**
 * Create VC Schema Controller
 * Creates in both database and blockchain
 */
export const createVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { name, schema, issuer_did } = req.body;

    const result = await SchemaService.createVCSchema({
      name,
      schema,
      issuer_did,
    });

    res.status(201).json({
      success: true,
      message: result.message,
      data: result.schema,
      transaction_hash: result.transaction_hash,
    });
  }
);

/**
 * Update VC Schema Controller
 * Creates new version in both database and blockchain
 */
export const updateVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { id } = req.params;
    const { schema } = req.body;

    const result = await SchemaService.updateVCSchema(id, { schema });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.schema,
      transaction_hash: result.transaction_hash,
    });
  }
);

/**
 * Deactivate VC Schema Controller
 * Deactivates in both database and blockchain
 */
export const deactivateVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await SchemaService.deactivateVCSchema(id);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.schema,
      transaction_hash: result.transaction_hash,
    });
  }
);

/**
 * Reactivate VC Schema Controller
 * Reactivates in both database and blockchain
 */
export const reactivateVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await SchemaService.reactivateVCSchema(id);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.schema,
      transaction_hash: result.transaction_hash,
    });
  }
);

/**
 * Delete VC Schema Controller
 * Soft delete (deactivate) in both database and blockchain
 */
export const deleteVCSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await SchemaService.deleteVCSchema(id);

    res.status(200).json({
      success: true,
      message: result.message,
      transaction_hash: result.transaction_hash,
    });
  }
);
