// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
import type { Request, Response } from "express";
import { z } from "zod";
import { IMPACT_LEVELS, RESOURCE_TYPES } from "../constants";
import { sendOk } from "../lib/response";
import { idParams, versionField } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { incidentService } from "../services/IncidentService";

export const reportIncidentSchema = z.object({
  resourceId: z.string().min(1),
  description: z.string().trim().min(1),
  impactLevel: z.enum(IMPACT_LEVELS),
  affectedScope: z.object({
    resourceType: z.enum(RESOURCE_TYPES),
    affectedReservationIds: z.array(z.string()),
  }),
});
export const handlingPlanSchema = z.object({
  handlingPlan: z.object({
    expectedVersion: versionField,
    actions: z.array(
      z.object({
        reservationId: z.string().min(1),
        action: z.enum(["REALLOCATE", "CANCEL", "KEEP"]),
        targetResourceId: z.string().optional(),
      }),
    ),
  }),
});
export const verifyResolutionSchema = z.object({
  resolutionResult: z.object({ resolved: z.boolean(), note: z.string().optional() }),
});

export const incidentController = {
  /** POST /api/incidents */
  async report(req: Request, res: Response): Promise<void> {
    const { resourceId, description, impactLevel, affectedScope } = req.body;
    sendOk(
      res,
      await incidentService.reportIncident(resourceId, description, impactLevel, affectedScope, currentUser(req).id),
      201,
    );
  },

  /** POST /api/incidents/:id/handling-plan */
  async handlingPlan(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await incidentService.processHandlingPlan(id, req.body.handlingPlan, currentUser(req).id));
  },

  /** POST /api/incidents/:id/verify */
  async verify(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await incidentService.verifyResolution(id, req.body.resolutionResult, currentUser(req).id));
  },
};
