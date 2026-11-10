// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
import type { Request, Response } from "express";
import { z } from "zod";
import { IMPACT_LEVELS, RESOURCE_TYPES } from "../constants";
import { sendOk } from "../lib/response";
import { idParams, requestIdField, versionField } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { incidentService } from "../services/IncidentService";

export const reportIncidentSchema = z.object({
  requestId: requestIdField,
  resourceId: z.string().min(1),
  description: z.string().trim().min(1),
  impactLevel: z.enum(IMPACT_LEVELS),
  affectedScope: z.object({
    resourceType: z.enum(RESOURCE_TYPES),
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
  /** GET /api/incidents/context?resourceId= – Sequence: getIncidentContext(resourceId) */
  async context(req: Request, res: Response): Promise<void> {
    const { resourceId } = parseOrThrow(z.object({ resourceId: z.string().min(1) }), req.query);
    sendOk(res, await incidentService.getIncidentContext(resourceId));
  },

  /** GET /api/incidents/:id – Sequence: getIncidentDetails(incidentId) */
  async detail(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await incidentService.getIncidentDetails(id));
  },

  /** POST /api/incidents – Sequence: reportIncident */
  async report(req: Request, res: Response): Promise<void> {
    const { requestId, resourceId, description, impactLevel, affectedScope } = req.body;
    sendOk(
      res,
      await incidentService.reportIncident(
        requestId,
        resourceId,
        description,
        impactLevel,
        affectedScope,
        currentUser(req).id,
      ),
      201,
    );
  },

  /** POST /api/incidents/:id/handling-plan – Sequence: processHandlingPlan */
  async handlingPlan(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    const { requestId, handlingPlan } = req.body;
    sendOk(res, await incidentService.processHandlingPlan(requestId, id, handlingPlan, currentUser(req).id));
  },

  /** POST /api/incidents/:id/verify – Sequence: verifyResolution */
  async verify(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    const { requestId, resolutionResult } = req.body;
    sendOk(res, await incidentService.verifyResolution(requestId, id, resolutionResult, currentUser(req).id));
  },
};
