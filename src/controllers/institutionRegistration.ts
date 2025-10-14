import { RequestHandler } from "express";
import { validationResult } from "express-validator";
import { PrismaClient, RequestStatus } from "@prisma/client";
import "dotenv/config";

import {
  throwCustomError,
  addStatusCodeTo,
  hasNoValidationErrors,
} from "../utils/error";

const prisma = new PrismaClient();

/**
 * Create new institution registration
 */
export const createInstitutionRegistration: RequestHandler = async (
  req,
  res,
  next
) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { email, name, phone, country, website, address } = req.body;

    try {
      // Check if email already exists
      const existingInstitution =
        await prisma.institutionRegistration.findUnique({
          where: { email },
        });

      if (existingInstitution) {
        throwCustomError(
          "An institution registration already exists with this email",
          409
        );
      }

      // Create new institution registration
      const institutionRegistration =
        await prisma.institutionRegistration.create({
          data: {
            email,
            name,
            phone,
            country,
            website,
            address,
            status: "PENDING",
          },
        });

      return res.status(201).json({
        message: "Institution registration created successfully!",
        data: institutionRegistration,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

/**
 * Get all institution registrations
 */
export const getAllInstitutionRegistrations: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const { status } = req.query;

    const whereClause = status ? { status: status as RequestStatus } : {};

    const institutionRegistrations =
      await prisma.institutionRegistration.findMany({
        where: whereClause,
        orderBy: {
          id: "desc",
        },
      });

    return res.status(200).json({
      message: "Institution registrations retrieved successfully!",
      data: institutionRegistrations,
      total: institutionRegistrations.length,
    });
  } catch (error) {
    next(addStatusCodeTo(error as Error));
  }
};

/**
 * Get institution registration by ID
 */
export const getInstitutionRegistrationById: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    const institutionRegistration =
      await prisma.institutionRegistration.findUnique({
        where: { id },
      });

    if (!institutionRegistration) {
      throwCustomError("Institution registration not found", 404);
    }

    return res.status(200).json({
      message: "Institution registration retrieved successfully!",
      data: institutionRegistration,
    });
  } catch (error) {
    next(addStatusCodeTo(error as Error));
  }
};

/**
 * Update institution registration status
 */
export const updateInstitutionRegistrationStatus: RequestHandler = async (
  req,
  res,
  next
) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { id } = req.params;
    const { status } = req.body;

    try {
      // Check if institution registration exists
      const existingInstitution =
        await prisma.institutionRegistration.findUnique({
          where: { id },
        });

      if (!existingInstitution) {
        throwCustomError("Institution registration not found", 404);
      }

      // Update institution registration status
      const updatedInstitution = await prisma.institutionRegistration.update({
        where: { id },
        data: { status },
      });

      return res.status(200).json({
        message: "Institution registration status updated successfully!",
        data: updatedInstitution,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

/**
 * Update institution registration data
 */
export const updateInstitutionRegistration: RequestHandler = async (
  req,
  res,
  next
) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { id } = req.params;
    const { email, name, phone, country, website, address } = req.body;

    try {
      // Check if institution registration exists
      const existingInstitution =
        await prisma.institutionRegistration.findUnique({
          where: { id },
        });

      if (!existingInstitution) {
        throwCustomError("Institution registration not found", 404);
      }

      // If email is being updated, check if new email already exists
      if (email && existingInstitution && email !== existingInstitution.email) {
        const emailExists = await prisma.institutionRegistration.findUnique({
          where: { email },
        });

        if (emailExists) {
          throwCustomError(
            "An institution registration already exists with this email",
            409
          );
        }
      }

      // Update institution registration
      const updatedInstitution = await prisma.institutionRegistration.update({
        where: { id },
        data: {
          ...(email && { email }),
          ...(name && { name }),
          ...(phone && { phone }),
          ...(country && { country }),
          ...(website && { website }),
          ...(address && { address }),
        },
      });

      return res.status(200).json({
        message: "Institution registration updated successfully!",
        data: updatedInstitution,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

/**
 * Delete institution registration
 */
export const deleteInstitutionRegistration: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    // Check if institution registration exists
    const existingInstitution = await prisma.institutionRegistration.findUnique(
      {
        where: { id },
      }
    );

    if (!existingInstitution) {
      throwCustomError("Institution registration not found", 404);
    }

    // Delete institution registration
    await prisma.institutionRegistration.delete({
      where: { id },
    });

    return res.status(200).json({
      message: "Institution registration deleted successfully!",
    });
  } catch (error) {
    next(addStatusCodeTo(error as Error));
  }
};
