// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
import { Router } from "express";
import { Role } from "@hub/shared";
import { filterSchema, searchController, searchCriteriaSchema, selectSchema } from "../controllers/SearchController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const searchRoutes = Router();
searchRoutes.use(requireAuth, requireRole(Role.STUDENT));

searchRoutes.post("/options", validateBody(searchCriteriaSchema), searchController.findOptions);
searchRoutes.post("/filter", validateBody(filterSchema), searchController.filterOptions);
searchRoutes.post("/sessions/:sessionId/select", validateBody(selectSchema), searchController.selectOption);
