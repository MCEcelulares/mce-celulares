import path from 'path';

export const pastaUploads = () => process.env.UPLOADS_DIR ?? path.resolve(process.cwd(), 'uploads');

export const urlBaseImagens = () => (process.env.IMAGENS_URL_BASE ?? '/catalogo/imagens').replace(/\/$/, '');
