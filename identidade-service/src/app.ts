import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { logarRequisicao } from './middlewares/requestLogger';
import { rotaNaoEncontrada, tratarErros } from './middlewares/errorHandler';
import { medirRequisicao } from './utils/metricas';

export const app = express();

app.set('trust proxy', 1);

app.use(logarRequisicao);
app.use(medirRequisicao);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.use(routes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);
