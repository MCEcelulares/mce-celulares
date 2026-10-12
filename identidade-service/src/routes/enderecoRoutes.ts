import { Router } from "express";
import * as enderecoController from "../controllers/enderecoController";
import { autenticar } from "../middlewares/authMiddleware";
import { donoOuPermissao } from "../middlewares/permissaoMiddleware";
import { validar } from "../middlewares/validate";
import {
  criarEnderecoSchema,
  atualizarEnderecoSchema,
} from "../validators/enderecoValidators";
import {
  idParamSchema,
  enderecoParamsSchema,
} from "../validators/paramsValidators";

const router = Router({ mergeParams: true });

router.get(
  "/",
  autenticar,
  validar(idParamSchema, "params"),
  donoOuPermissao("usuarios:ver"),
  enderecoController.listar,
);

router.get(
  "/:idEndereco",
  autenticar,
  validar(enderecoParamsSchema, "params"),
  donoOuPermissao("usuarios:ver"),
  enderecoController.buscar,
);

router.post(
  "/",
  autenticar,
  validar(idParamSchema, "params"),
  donoOuPermissao(),
  validar(criarEnderecoSchema),
  enderecoController.criar,
);

router.patch(
  "/:idEndereco",
  autenticar,
  validar(enderecoParamsSchema, "params"),
  donoOuPermissao(),
  validar(atualizarEnderecoSchema),
  enderecoController.atualizar,
);

router.patch(
  "/:idEndereco/principal",
  autenticar,
  validar(enderecoParamsSchema, "params"),
  donoOuPermissao(),
  enderecoController.marcarPrincipal,
);

router.delete(
  "/:idEndereco",
  autenticar,
  validar(enderecoParamsSchema, "params"),
  donoOuPermissao(),
  enderecoController.remover,
);

export default router;
