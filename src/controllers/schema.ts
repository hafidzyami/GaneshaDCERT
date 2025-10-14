import { RequestHandler } from "express";
import { validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";

import {
  throwCustomError,
  addStatusCodeTo,
  hasNoValidationErrors,
} from "../utils/error";

const prisma = new PrismaClient();

/**
 * Get all VC Schemas, with an optional filter by issuer DID.
 */
export const getAllVCSchemas: RequestHandler = async (req, res, next) => {
  try {
    const { issuerDid } = req.query;

    const whereClause = issuerDid ? { issuer_did: issuerDid as string } : {};

    const schemas = await prisma.vCSchema.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(schemas);
  } catch (error) {
    next(addStatusCodeTo(error as Error));
  }
};

/**
 * Register a new VC Schema.
 */
export const createVCSchema: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { id, name, schema, issuer_did, version } = req.body;

    try {
      // TODO: Interact with blockchain to store the schema.
      console.log("Creating VC Schema on-chain...");

      const newSchema = await prisma.vCSchema.create({
        data: { id, name, schema, issuer_did, version },
      });

      return res.status(201).json({
        message: "VC Schema registered successfully",
        schema_id: newSchema.id,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

/**
 * Update an existing VC Schema.
 */
export const updateVCSchema: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { schemaId } = req.params;
    const { name, schema, issuer_did, version } = req.body;

    try {
      const existingSchema = await prisma.vCSchema.findUnique({
        where: { id: schemaId },
      });

      if (!existingSchema) {
        throwCustomError("VC Schema not found", 404);
      } else {
        if (version <= existingSchema.version) {
          throwCustomError(
            `Version must be greater than current version (${existingSchema.version})`,
            400
          );
        }
      }

      // According to spec, version number must be incremented.

      // TODO: Interact with blockchain to update the schema and create a new version.
      console.log(`Updating VC Schema ${schemaId} on-chain...`);

      const updatedSchema = await prisma.vCSchema.update({
        where: { id: schemaId },
        data: { name, schema, issuer_did, version },
      });

      return res.status(200).json({
        message: "VC schema updated successfully",
        schema: updatedSchema,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};
