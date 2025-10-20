import { Request, Response } from "express";
import { validationResult } from "express-validator";
import SchemaService from "../services/schema.service";
import { ValidationError } from "../utils/errors/AppError";
import { asyncHandler } from "../middlewares/errorHandler.middleware";

/**
 * Get All VC Schemas Controller
 */
export const getAllVCSchemas = asyncHandler(async (req: Request, res: Response) => {
  const { issuerDid } = req.query;

  const schemas = await SchemaService.getAllVCSchemas(issuerDid as string | undefined);

  res.status(200).json({
    success: true,
    count: Array.isArray(schemas) ? schemas.length : 0,
    data: schemas,
  });
});

/**
 * Create VC Schema Controller
 */
export const createVCSchema = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { id, name, schema, issuer_did, version } = req.body;

  const result = await SchemaService.createVCSchema({
    id,
    name,
    schema,
    issuer_did,
    version,
  });

  res.status(201).json({
    success: true,
    ...result,
  });
});

/**
 * Update VC Schema Controller
 */
export const updateVCSchema = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { schemaId } = req.params;
  const { name, schema, issuer_did, version } = req.body;

  const result = await SchemaService.updateVCSchema(schemaId, {
    name,
    schema,
    issuer_did,
    version,
  });

  res.status(200).json({
    success: true,
    ...result,
  });
});
