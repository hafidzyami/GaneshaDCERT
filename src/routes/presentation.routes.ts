import express, { Router } from "express";
import * as vp from "../controllers/presentation.controller";
import {
  requestVPValidator,
  getVPRequestDetailsValidator,
  storeVPValidator,
  getVPValidator,
} from "../validators/presentation.validator";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Verification & Presentation (VP) Flow
 *   description: Verifiable Presentation request and sharing endpoints
 */

// Verifier requests VP from holder
router.post("/request", requestVPValidator, vp.requestVP);

// Holder gets VP request details
router.get("/request/:vpReqId", getVPRequestDetailsValidator, vp.getVPRequestDetails);

// Holder stores VP for sharing
router.post("/", storeVPValidator, vp.storeVP);

// Verifier retrieves stored VP
router.get("/:vpId", getVPValidator, vp.getVP);

export default router;
