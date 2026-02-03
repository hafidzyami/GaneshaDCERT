import { Router, Request, Response, NextFunction } from "express";
import CacheService from "../services/cache.service";
import { adminAuthMiddleware } from "../middlewares";
import { CACHE_TTL, CACHE_PREFIX } from "../services/cache.service";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Cache
 *   description: Cache management endpoints (Admin only)
 */

/**
 * @swagger
 * /cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     description: Get Redis cache statistics including key count and memory usage
 *     tags:
 *       - Cache
 *     security:
 *       - AdminBearerAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 stats:
 *                   type: object
 *                   properties:
 *                     keys:
 *                       type: number
 *                       example: 150
 *                     memory:
 *                       type: string
 *                       example: "2.5M"
 *                     uptime:
 *                       type: number
 *                       example: 3600
 *                 config:
 *                   type: object
 *                   properties:
 *                     ttl:
 *                       type: object
 *                       description: TTL configuration in seconds
 *                     prefixes:
 *                       type: object
 *                       description: Cache key prefixes
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  "/stats",
  adminAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await CacheService.getStats();
      const healthy = await CacheService.isHealthy();

      res.json({
        success: true,
        healthy,
        stats,
        config: {
          ttl: CACHE_TTL,
          prefixes: CACHE_PREFIX,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cache/health:
 *   get:
 *     summary: Check cache health
 *     description: Check if Redis cache is healthy and responding
 *     tags:
 *       - Cache
 *     responses:
 *       200:
 *         description: Cache health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 healthy:
 *                   type: boolean
 *                   example: true
 */
router.get(
  "/health",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const healthy = await CacheService.isHealthy();
      res.json({
        success: true,
        healthy,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cache/invalidate/did/{did}:
 *   delete:
 *     summary: Invalidate DID Document cache
 *     description: Remove a specific DID Document from cache
 *     tags:
 *       - Cache
 *     security:
 *       - AdminBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         description: The DID to invalidate
 *     responses:
 *       200:
 *         description: Cache invalidated
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/invalidate/did/:did",
  adminAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { did } = req.params;
      await CacheService.invalidateDID(did);
      res.json({
        success: true,
        message: `DID Document cache invalidated for: ${did}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cache/invalidate/schema/{schemaId}:
 *   delete:
 *     summary: Invalidate Schema cache
 *     description: Remove all versions of a schema from cache
 *     tags:
 *       - Cache
 *     security:
 *       - AdminBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemaId
 *         required: true
 *         schema:
 *           type: string
 *         description: The Schema ID to invalidate
 *     responses:
 *       200:
 *         description: Cache invalidated
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/invalidate/schema/:schemaId",
  adminAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { schemaId } = req.params;
      await CacheService.invalidateSchema(schemaId);
      res.json({
        success: true,
        message: `Schema cache invalidated for: ${schemaId}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cache/invalidate/institution/{did}:
 *   delete:
 *     summary: Invalidate Institution cache
 *     description: Remove a specific Institution from cache
 *     tags:
 *       - Cache
 *     security:
 *       - AdminBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         description: The Institution DID to invalidate
 *     responses:
 *       200:
 *         description: Cache invalidated
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/invalidate/institution/:did",
  adminAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { did } = req.params;
      await CacheService.invalidateInstitution(did);
      res.json({
        success: true,
        message: `Institution cache invalidated for: ${did}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cache/invalidate/all:
 *   delete:
 *     summary: Invalidate all caches
 *     description: Flush all cache entries (use with caution)
 *     tags:
 *       - Cache
 *     security:
 *       - AdminBearerAuth: []
 *     responses:
 *       200:
 *         description: All caches invalidated
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/invalidate/all",
  adminAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await CacheService.flushAll();
      res.json({
        success: true,
        message: "All cache entries have been flushed",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cache/invalidate/dids:
 *   delete:
 *     summary: Invalidate all DID Document caches
 *     description: Remove all DID Documents from cache
 *     tags:
 *       - Cache
 *     security:
 *       - AdminBearerAuth: []
 *     responses:
 *       200:
 *         description: All DID caches invalidated
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/invalidate/dids",
  adminAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await CacheService.invalidateAllDIDs();
      res.json({
        success: true,
        message: "All DID Document caches have been invalidated",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cache/invalidate/schemas:
 *   delete:
 *     summary: Invalidate all Schema caches
 *     description: Remove all Schemas from cache
 *     tags:
 *       - Cache
 *     security:
 *       - AdminBearerAuth: []
 *     responses:
 *       200:
 *         description: All Schema caches invalidated
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/invalidate/schemas",
  adminAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await CacheService.invalidateAllSchemas();
      res.json({
        success: true,
        message: "All Schema caches have been invalidated",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cache/invalidate/institutions:
 *   delete:
 *     summary: Invalidate all Institution caches
 *     description: Remove all Institutions from cache
 *     tags:
 *       - Cache
 *     security:
 *       - AdminBearerAuth: []
 *     responses:
 *       200:
 *         description: All Institution caches invalidated
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/invalidate/institutions",
  adminAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await CacheService.invalidateAllInstitutions();
      res.json({
        success: true,
        message: "All Institution caches have been invalidated",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
