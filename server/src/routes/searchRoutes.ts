// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
import { Router } from "express";
import { searchController, searchCriteriaSchema, selectSchema } from "../controllers/SearchController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const searchRoutes = Router();
searchRoutes.use(requireAuth, requireRole("STUDENT"));

searchRoutes.post("/options", validateBody(searchCriteriaSchema), searchController.findOptions);
searchRoutes.post("/sessions/:sessionId/select", validateBody(selectSchema), searchController.selectOption);
