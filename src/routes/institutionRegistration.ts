import express, { Router } from "express";
import { body, param, query } from "express-validator";

import * as institutionRegistration from "../controllers/institutionRegistration";

const router: Router = express.Router();

/**
 * @swagger
 * /institution-registration:
 *   post:
 *     summary: Create new institution registration
 *     description: Register a new institution with pending status
 *     tags:
 *       - Institution Registration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *               - phone
 *               - country
 *               - website
 *               - address
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: institution@example.com
 *               name:
 *                 type: string
 *                 example: University of Example
 *               phone:
 *                 type: string
 *                 example: +62812345678
 *               country:
 *                 type: string
 *                 example: Indonesia
 *               website:
 *                 type: string
 *                 example: https://example.edu
 *               address:
 *                 type: string
 *                 example: Jl. Example No. 123, Jakarta
 *     responses:
 *       201:
 *         description: Institution registration created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */
router.post(
  "/",
  [
    body("email", "Email is required and must be valid")
      .trim()
      .isEmail()
      .normalizeEmail(),
    body("name", "Name must not be empty")
      .trim()
      .not()
      .isEmpty(),
    body("phone", "Phone must not be empty")
      .trim()
      .not()
      .isEmpty(),
    body("country", "Country must not be empty")
      .trim()
      .not()
      .isEmpty(),
    body("website", "Website must be a valid URL")
      .trim()
      .isURL(),
    body("address", "Address must not be empty")
      .trim()
      .not()
      .isEmpty(),
  ],
  institutionRegistration.createInstitutionRegistration
);

/**
 * @swagger
 * /institution-registration:
 *   get:
 *     summary: Get all institution registrations
 *     description: Retrieve all institution registrations with optional status filter
 *     tags:
 *       - Institution Registration
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter by registration status
 *     responses:
 *       200:
 *         description: Institution registrations retrieved successfully
 */
router.get(
  "/",
  [
    query("status")
      .optional()
      .isIn(["PENDING", "APPROVED", "REJECTED"])
      .withMessage("Status must be PENDING, APPROVED, or REJECTED")
  ],
  institutionRegistration.getAllInstitutionRegistrations
);

/**
 * @swagger
 * /institution-registration/{id}:
 *   get:
 *     summary: Get institution registration by ID
 *     description: Retrieve a specific institution registration by its ID
 *     tags:
 *       - Institution Registration
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Institution registration ID
 *     responses:
 *       200:
 *         description: Institution registration retrieved successfully
 *       404:
 *         description: Institution registration not found
 */
router.get(
  "/:id",
  [
    param("id", "Invalid ID format")
      .trim()
      .not()
      .isEmpty()
  ],
  institutionRegistration.getInstitutionRegistrationById
);

/**
 * @swagger
 * /institution-registration/{id}/status:
 *   patch:
 *     summary: Update institution registration status
 *     description: Update the status of an institution registration (PENDING, APPROVED, REJECTED)
 *     tags:
 *       - Institution Registration
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Institution registration ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED]
 *                 example: APPROVED
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       404:
 *         description: Institution registration not found
 */
router.patch(
  "/:id/status",
  [
    param("id", "Invalid ID format")
      .trim()
      .not()
      .isEmpty(),
    body("status", "Status must be PENDING, APPROVED, or REJECTED")
      .isIn(["PENDING", "APPROVED", "REJECTED"])
  ],
  institutionRegistration.updateInstitutionRegistrationStatus
);

/**
 * @swagger
 * /institution-registration/{id}:
 *   put:
 *     summary: Update institution registration data
 *     description: Update institution registration information
 *     tags:
 *       - Institution Registration
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Institution registration ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               country:
 *                 type: string
 *               website:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Institution registration updated successfully
 *       404:
 *         description: Institution registration not found
 *       409:
 *         description: Email already exists
 */
router.put(
  "/:id",
  [
    param("id", "Invalid ID format")
      .trim()
      .not()
      .isEmpty(),
    body("email")
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage("Email must be valid"),
    body("name")
      .optional()
      .trim()
      .not()
      .isEmpty()
      .withMessage("Name must not be empty"),
    body("phone")
      .optional()
      .trim()
      .not()
      .isEmpty()
      .withMessage("Phone must not be empty"),
    body("country")
      .optional()
      .trim()
      .not()
      .isEmpty()
      .withMessage("Country must not be empty"),
    body("website")
      .optional()
      .trim()
      .isURL()
      .withMessage("Website must be a valid URL"),
    body("address")
      .optional()
      .trim()
      .not()
      .isEmpty()
      .withMessage("Address must not be empty"),
  ],
  institutionRegistration.updateInstitutionRegistration
);

/**
 * @swagger
 * /institution-registration/{id}:
 *   delete:
 *     summary: Delete institution registration
 *     description: Delete a specific institution registration
 *     tags:
 *       - Institution Registration
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Institution registration ID
 *     responses:
 *       200:
 *         description: Institution registration deleted successfully
 *       404:
 *         description: Institution registration not found
 */
router.delete(
  "/:id",
  [
    param("id", "Invalid ID format")
      .trim()
      .not()
      .isEmpty()
  ],
  institutionRegistration.deleteInstitutionRegistration
);

export default router;
