// controllers/agentPublicController.ts
import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import Agent from "../models/Agent";
import { getNextSequence, buildAgentCode, randomSuffix, generateAuthCode } from "../services/counterService";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { normalizePhone } from "../utils/phone";

export const registerAgent = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const country = String(req.body?.country || "").trim();
    const firstName = String(req.body?.firstName || "").trim();
    const lastName = String(req.body?.lastName || "").trim();
    const phone = normalizePhone(req.body?.phone);
    const gender = String(req.body?.gender || "").trim();
    const birthDate = String(req.body?.birthDate || "").trim();
    const city = String(req.body?.city || "").trim();
    const idType = String(req.body?.idType || "").trim();
    const idNumber = String(req.body?.idNumber || "").trim();

    if (!country || !firstName || !lastName || !phone || !gender || !birthDate || !city || !idType || !idNumber) {
      return next(new ValidationError("Tous les champs obligatoires doivent être remplis"));
    }

    const exists = await Agent.findOne({ phone }).select("_id").lean();
    if (exists) {
      return res.status(409).json({ error: "Un agent avec ce téléphone existe déjà" });
    }

    const seq = await getNextSequence("agent", 1000);
    let suffix = randomSuffix();
    let code = buildAgentCode(seq, suffix);

    for (let tries = 0; tries < 10; tries++) {
      const codeExists = await Agent.findOne({ code }).select("_id").lean();
      if (!codeExists) break;
      suffix = randomSuffix();
      code = buildAgentCode(seq, suffix);
      if (tries === 9) {
        return res.status(500).json({ error: "Impossible de générer un code agent unique" });
      }
    }

    const authCode = generateAuthCode(6);
    const authCodeHash = await bcrypt.hash(authCode, 10);

    const idPhotoPath = files?.idPhoto?.[0]?.path || "";
    const selfiePhotoPath = files?.selfiePhoto?.[0]?.path || "";

    const agent = new Agent({
      code,
      codeNumber: seq,
      codeSuffix: suffix,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      phone,
      country,
      gender,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      city,
      idType,
      idNumber,
      idPhotoPath,
      selfiePhotoPath,
      authCodeHash,
      authCodeIssuedAt: new Date(),
      isActive: true,
      isApproved: false,
      mustChangePassword: true,
    });

    await agent.save();

    res.status(201).json({
      message: "Candidature soumise avec succès",
      agent: {
        id: agent._id,
        code: agent.code,
        name: agent.name,
        phone: agent.phone,
      },
    });
  });
