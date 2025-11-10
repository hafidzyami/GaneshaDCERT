import express, { Router } from "express";
import * as institutionController from "../controllers/institution.controller";
import {
  getAllInstitutionsValidator,
  getInstitutionByDIDValidator,
  updateInstitutionValidator,
  deleteInstitutionValidator,
} from "../validators/institution.validator";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Institutions
 *   description: Institution management endpoints
 */

/**
 * @swagger
 * /institutions:
 *   get:
 *     summary: Get all institutions
 *     description: Retrieve all institutions with pagination, search, and filtering capabilities
 *     tags:
 *       - Institutions
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, or DID
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Filter by country
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of institutions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Successfully retrieved 10 institutions
 *                 data:
 *                   type: object
 *                   properties:
 *                     institutions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           did:
 *                             type: string
 *                             example: did:dcert:i1234567890abcdef
 *                           email:
 *                             type: string
 *                             format: email
 *                           name:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           country:
 *                             type: string
 *                           website:
 *                             type: string
 *                             format: uri
 *                           address:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Internal server error
 */
router.get("/", getAllInstitutionsValidator, institutionController.getAllInstitutions);

/**
 * @swagger
 * /institutions/{did}:
 *   get:
 *     summary: Get institution by DID
 *     description: Retrieve a single institution by its DID
 *     tags:
 *       - Institutions
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         description: Institution DID
 *         example: did:dcert:i1234567890abcdef
 *     responses:
 *       200:
 *         description: Institution retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Institution retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     did:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     country:
 *                       type: string
 *                     website:
 *                       type: string
 *                     address:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid DID format
 *       404:
 *         description: Institution not found
 *       500:
 *         description: Internal server error
 */
router.get("/:did", getInstitutionByDIDValidator, institutionController.getInstitutionByDID);

/**
 * @swagger
 * /institutions/{did}:
 *   put:
 *     summary: Update institution by DID
 *     description: Update institution information (excluding DID and email)
 *     tags:
 *       - Institutions
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         description: Institution DID
 *         example: did:dcert:i1234567890abcdef
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated University Name
 *               phone:
 *                 type: string
 *                 example: +6281234567890
 *               country:
 *                 type: string
 *                 example: Indonesia
 *               website:
 *                 type: string
 *                 format: uri
 *                 example: https://example.edu
 *               address:
 *                 type: string
 *                 example: Jl. Example No. 123, Jakarta
 *     responses:
 *       200:
 *         description: Institution updated successfully
 *       400:
 *         description: Invalid request data or DID format
 *       404:
 *         description: Institution not found
 *       500:
 *         description: Internal server error
 */
router.put("/:did", updateInstitutionValidator, institutionController.updateInstitution);

/**
 * @swagger
 * /institutions/{did}:
 *   delete:
 *     summary: Delete institution by DID
 *     description: Delete an institution by its DID
 *     tags:
 *       - Institutions
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         description: Institution DID
 *         example: did:dcert:i1234567890abcdef
 *     responses:
 *       200:
 *         description: Institution deleted successfully
 *       400:
 *         description: Invalid DID format
 *       404:
 *         description: Institution not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:did", deleteInstitutionValidator, institutionController.deleteInstitution);

export default router;
