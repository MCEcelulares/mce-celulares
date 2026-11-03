jest.unmock('../src/services/emailService');

let emAndamento = 0;
let maximoSimultaneo = 0;
const sendMail = jest.fn(async () => {
  emAndamento++;
  maximoSimultaneo = Math.max(maximoSimultaneo, emAndamento);
  await new Promise((resolve) => setTimeout(resolve, 20));
  emAndamento--;
});

jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }));

import { enviarEmail } from '../src/services/emailService';

const email = { para: 'a@mce.test', assunto: 'Oi', texto: 'Olá' };

beforeEach(() => {
  sendMail.mockClear();
  maximoSimultaneo = 0;
  emAndamento = 0;
  delete process.env.EMAIL_INTERVALO_MS;
});

describe('fila de envio de e-mails', () => {
  it('envia um e-mail por vez, mesmo com chamadas simultâneas', async () => {
    await Promise.all([enviarEmail(email), enviarEmail(email), enviarEmail(email)]);
    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(maximoSimultaneo).toBe(1);
  });

  it('respeita o intervalo mínimo entre envios (EMAIL_INTERVALO_MS)', async () => {
    process.env.EMAIL_INTERVALO_MS = '80';
    const inicio = Date.now();
    await Promise.all([enviarEmail(email), enviarEmail(email)]);
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(160);
  });

  it('uma falha não trava os envios seguintes', async () => {
    sendMail.mockRejectedValueOnce(new Error('smtp fora do ar'));
    await expect(enviarEmail(email)).rejects.toThrow('smtp fora do ar');
    await expect(enviarEmail(email)).resolves.toBeUndefined();
  });

  it('repassa o Reply-To e o remetente configurado', async () => {
    process.env.EMAIL_REMETENTE = 'Loja <loja@mce.test>';
    await enviarEmail({ ...email, responderPara: 'cliente@mce.test' });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: 'cliente@mce.test', from: 'Loja <loja@mce.test>', to: 'a@mce.test' })
    );
  });
});
