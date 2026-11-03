import express from 'express';
import helmet from 'helmet';
import routes from './routes';
import { logarRequisicao } from './middlewares/requestLogger';
import { rotaNaoEncontrada, tratarErros } from './middlewares/errorHandler';
import { medirRequisicao } from './utils/metricas';
import { configurarCors } from './utils/cors';
import { limitarGeral } from './utils/rateLimit';
import { pastaUploads } from './config/uploads';

export const app = express();

app.set('trust proxy', 1);

app.use(logarRequisicao);
app.use(medirRequisicao);
app.use(helmet());
app.use(configurarCors());
app.use(limitarGeral);

// Imagens de produto (RF15). Os nomes são UUIDs gerados pelo servidor e nunca mudam, então podem ficar em cache.
// O helmet bloqueia o uso da imagem por outra origem (front em outro domínio); aqui isso é liberado de propósito.
app.use(
  '/imagens',
  express.static(pastaUploads(), {
    index: false,
    dotfiles: 'deny',
    maxAge: '7d',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

app.use(express.json({ limit: '100kb' }));

app.use(routes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);
