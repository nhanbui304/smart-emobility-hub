// Owner: Bùi Quang Nhân – Register Student Account, Sign In, Sign Out, Customize Interface Mode
import { Router } from "express";
import {
  authController,
  loginSchema,
  privateVehicleSchema,
  registerSchema,
  themeSchema,
} from "../controllers/AuthController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const authRoutes = Router();

authRoutes.post("/register", validateBody(registerSchema), authController.register);
authRoutes.post("/login", validateBody(loginSchema), authController.login);
authRoutes.post("/logout", authController.logout);
authRoutes.get("/me", requireAuth, authController.me);
authRoutes.get("/me/vehicles", requireAuth, authController.myVehicles); // thêm ngoài sơ đồ
authRoutes.post(
  "/me/vehicles",
  requireAuth,
  requireRole("STUDENT"),
  validateBody(privateVehicleSchema),
  authController.createMyVehicle,
);
authRoutes.patch(
  "/me/vehicles/:vehicleId",
  requireAuth,
  requireRole("STUDENT"),
  validateBody(privateVehicleSchema),
  authController.updateMyVehicle,
);
authRoutes.delete(
  "/me/vehicles/:vehicleId",
  requireAuth,
  requireRole("STUDENT"),
  authController.deleteMyVehicle,
);
authRoutes.patch("/me/theme", requireAuth, validateBody(themeSchema), authController.updateTheme);
