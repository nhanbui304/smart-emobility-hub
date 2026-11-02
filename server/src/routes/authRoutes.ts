// Owner: Bùi Quang Nhân – Register Student Account, Sign In, Sign Out, Customize Interface Mode
import { Router } from "express";
import { authController, loginSchema, registerSchema, themeSchema } from "../controllers/AuthController";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const authRoutes = Router();

authRoutes.post("/register", validateBody(registerSchema), authController.register);
authRoutes.post("/login", validateBody(loginSchema), authController.login);
authRoutes.post("/logout", authController.logout);
authRoutes.get("/me", requireAuth, authController.me);
authRoutes.patch("/me/theme", requireAuth, validateBody(themeSchema), authController.updateTheme);
