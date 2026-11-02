// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
import type { Request, Response } from "express";
import { z } from "zod";
import { ImpactLevel, ResourceType, enumValues } from "@hub/shared";
import { sendOk } from "../lib/response";
import { idParams, requestIdField, versionField } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { incidentService } from "../services/IncidentService";

export const reportIncidentSchema = z.object({
  requestId: requestIdField,
  resourceId: z.string().min(1),
  description: z.string().trim().min(1),
  impactLevel: z.enum(enumValues(ImpactLevel)),
  affectedScope: z.object({
    resourceType: z.enum(enumValues(ResourceType)),
    affectedReservationIds: z.array(z.string()),
  }),
});
export const handlingPlanSchema = z.object({
  requestId: requestIdField,
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
  requestId: requestIdField,
  resolutionResult: z.object({ resolved: z.boolean(), note: z.string().optional() }),
});

export const incidentController = {
  /** POST /api/incidents */
  async report(req: Request, res: Response): Promise<void> {
    const { requestId, resourceId, description, impactLevel, affectedScope } = req.body;
    sendOk(res, await incidentService.reportIncident(
        requestId,
        resourceId,
        description,
        impactLevel,
        affectedScope,
        currentUser(req).id,
      ), 201);
  },

  /** POST /api/incidents/:id/handling-plan */
  async handlingPlan(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(
      res,
      await incidentService.processHandlingPlan(req.body.requestId, id, req.body.handlingPlan, currentUser(req).id),
    );
  },

  /** POST /api/incidents/:id/verify */
  async verify(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(
      res,
      await incidentService.verifyResolution(req.body.requestId, id, req.body.resolutionResult, currentUser(req).id),
    );
  },
};
