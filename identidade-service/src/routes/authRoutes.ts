import { Router } from "express";
import * as authController from "../controllers/authController";
import { autenticar } from "../middlewares/authMiddleware";
import { validar } from "../middlewares/validate";
import { limitarLogin } from "../utils/rateLimit";
import {
  loginSchema,
  loginGoogleSchema,
  refreshSchema,
} from "../validators/authValidators";

const router = Router();

router.post("/login", limitarLogin, validar(loginSchema), authController.login);
router.post(
  "/google",
  limitarLogin,
  validar(loginGoogleSchema),
  authController.loginGoogle,
);

router.post(
  "/refresh",
  limitarLogin,
  validar(refreshSchema),
  authController.renovar,
);

router.post("/logout", validar(refreshSchema), authController.logout);

router.post("/logout-todos", autenticar, authController.logoutTodos);

export default router;
