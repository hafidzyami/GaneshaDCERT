import { Request, Response } from "express";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";
import PerformanceService from "../services/performance.service";

/**
 * Performance Testing Controller
 * Endpoints for benchmarking database vs blockchain performance
 */

/**
 * Get all schemas from database (for performance testing)
 * @route GET /api/performance/schemas/database
 */
export const getAllSchemasFromDatabase = asyncHandler(
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    const schemas = await PerformanceService.getAllSchemasFromDatabase();

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    return ResponseHelper.success(res, {
      source: "database",
      responseTime: `${responseTime}ms`,
      count: schemas.length,
      data: schemas,
    });
  }
);

/**
 * Get all schemas from blockchain (for performance testing)
 * @route GET /api/performance/schemas/blockchain
 */
export const getAllSchemasFromBlockchain = asyncHandler(
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    const schemas = await PerformanceService.getAllSchemasFromBlockchain();

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    return ResponseHelper.success(res, {
      source: "blockchain",
      responseTime: `${responseTime}ms`,
      count: schemas.length,
      data: schemas,
    });
  }
);

/**
 * Get specific schema from database by ID and version (for performance testing)
 * @route GET /api/performance/schemas/database/:schemaId/:version
 */
export const getSchemaFromDatabase = asyncHandler(
  async (req: Request, res: Response) => {
    const { schemaId, version } = req.params;
    const versionNumber = parseInt(version);

    const startTime = Date.now();

    const schema = await PerformanceService.getSchemaFromDatabase(
      schemaId,
      versionNumber
    );

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    return ResponseHelper.success(res, {
      source: "database",
      responseTime: `${responseTime}ms`,
      data: schema,
    });
  }
);

/**
 * Get specific schema from blockchain by ID and version (for performance testing)
 * @route GET /api/performance/schemas/blockchain/:schemaId/:version
 */
export const getSchemaFromBlockchain = asyncHandler(
  async (req: Request, res: Response) => {
    const { schemaId, version } = req.params;
    const versionNumber = parseInt(version);

    const startTime = Date.now();

    const schema = await PerformanceService.getSchemaFromBlockchain(
      schemaId,
      versionNumber
    );

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    return ResponseHelper.success(res, {
      source: "blockchain",
      responseTime: `${responseTime}ms`,
      data: schema,
    });
  }
);
