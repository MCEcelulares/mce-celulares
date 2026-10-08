import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { tratarErros } from './middlewares/errorHandler';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(routes);

app.use(tratarErros);
