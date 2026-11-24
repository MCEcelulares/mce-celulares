import { reenviarNotificacoes } from '../services/notificacaoService';
import { logger } from '../utils/logger';

export function iniciarReenvioDeNotificacoes(): NodeJS.Timeout {
  const intervaloMs = Number(process.env.NOTIFICACAO_REENVIO_VERIFICAR_SEGUNDOS ?? 60) * 1000;
  let rodando = false;

  const timer = setInterval(() => {
    if (rodando) return;
    rodando = true;
    reenviarNotificacoes()
      .then((n) => n > 0 && logger.info({ reenviadas: n }, 'notificações reenviadas'))
      .catch((err) => logger.error({ err }, 'falha na rotina de reenvio de notificações'))
      .finally(() => {
        rodando = false;
      });
  }, intervaloMs);
  timer.unref();
  logger.info('reenvio automático de notificações ligado');
  return timer;
}
