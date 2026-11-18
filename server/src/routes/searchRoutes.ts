// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
import { Router } from "express";
import { confirmOptionSelectionBody, searchController, searchMobilityOptionsBody } from "../controllers/SearchController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const searchRoutes = Router();
searchRoutes.use(requireAuth, requireRole("STUDENT"));

searchRoutes.get("/form", searchController.loadSearchForm);
searchRoutes.post("/options", validateBody(searchMobilityOptionsBody), searchController.searchMobilityOptions);
searchRoutes.post("/selections", validateBody(confirmOptionSelectionBody), searchController.confirmOptionSelection);
