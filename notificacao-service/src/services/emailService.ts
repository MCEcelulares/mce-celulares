import nodemailer from 'nodemailer';
import 'dotenv/config';

const porta = Number(process.env.SMTP_PORT ?? 587);

const transporte = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: porta,
  secure: porta === 465,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    : undefined,
  connectionTimeout: 5000,
  socketTimeout: 10000,
});

export interface Email {
  para: string;
  assunto: string;
  texto: string;
  responderPara?: string;
}

export async function enviarEmail({ para, assunto, texto, responderPara }: Email): Promise<void> {
  await transporte.sendMail({
    from: process.env.EMAIL_REMETENTE ?? 'MCE Celulares <nao-responda@mce.local>',
    to: para,
    subject: assunto,
    text: texto,
    replyTo: responderPara,
  });
}
