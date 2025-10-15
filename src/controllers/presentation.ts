import { RequestHandler } from "express";
import { validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import {
  throwCustomError,
  addStatusCodeTo,
  hasNoValidationErrors,
} from "../utils/error";

const prisma = new PrismaClient();

/**
 * Verifier requests a Verifiable Presentation (VP) from a holder.
 */
export const requestVP: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { holder_did, verifier_did, list_schema_id } = req.body;

    try {
      const requestId = uuidv4();

      const vpRequest = await prisma.vPRequest.create({
        data: {
          holder_did,
          verifier_did,
          list_schema_id,
        },
      });

      // TODO: Add Message Queue using RabbitMQ with the corresponding DID.

      return res.status(201).json({
        message: "VP request sent successfully. Awaiting Holder's response.",
        vp_request_id: requestId,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

/**
 * Endpoint untuk 'POST /api/presentations'.
 * Sesuai alur "Initiated by Holder" (Hal. 39), fungsi ini adalah tempat
 * Holder mengirimkan VP yang sudah disiapkan ke backend untuk disimpan sementara.
 */
export const storeVP: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { holder_did, vp } = req.body;
    try {
      // Menggunakan model `VPSharing` sebagai pengganti Redis untuk penyimpanan
      // sementara, sesuai dengan diagram "Set VP in Redis".
      const sharedVp = await prisma.vPSharing.create({
        data: {
          holder_did,
          VP: vp,
        },
      });

      console.log(
        `[VP Flow] Holder [${holder_did}] menyimpan VP dengan ID: ${sharedVp.id}`
      );

      return res.status(201).json({
        message: "VP stored successfully and is available for retrieval.",
        vp_id: sharedVp.id,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

/**
 * Endpoint untuk 'GET /api/presentations/{vpId}'.
 * Sesuai alur "Initiated by Holder" (Hal. 39), di sinilah Verifier
 * mengambil VP dari backend menggunakan ID unik yang didapat dari QR code.
 */
export const getVP: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { vpId } = req.params;
    try {
      // Mencari VP di `VPSharing`.
      const sharedVp = await prisma.vPSharing.findUnique({
        where: { id: vpId },
      });

      if (!sharedVp) {
        throwCustomError(
          "VP not found. It may have expired or already been used.",
          404
        );
      }

      // Alur "get & delete VP from Redis" pada diagram (Hal. 39)
      // mengindikasikan bahwa VP dihapus setelah berhasil diambil untuk
      // memastikan hanya bisa digunakan satu kali.
      await prisma.vPSharing.delete({
        where: { id: vpId },
      });

      console.log(
        `[VP Flow] Verifier mengambil VP dengan ID: ${vpId}. VP sekarang dihapus.`
      );

      return res.status(200).json({
        vp: sharedVp.VP,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};
