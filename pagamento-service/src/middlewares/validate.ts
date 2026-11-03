import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodTypeDef } from 'zod';

type Origem = 'body' | 'params' | 'query';

export function validar<Saida, Entrada>(
  schema: ZodType<Saida, ZodTypeDef, Entrada>,
  origem: Origem = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const resultado = schema.safeParse(req[origem]);
    if (!resultado.success) {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: resultado.error.flatten() });
    }
    Object.assign(req, { [origem]: resultado.data });
    next();
  };
}
