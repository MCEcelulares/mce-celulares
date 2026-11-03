import path from 'path';

// Onde as imagens de produto ficam no disco (em Docker, um volume) e sob qual URL o gateway as serve.
export const pastaUploads = () => process.env.UPLOADS_DIR ?? path.resolve(process.cwd(), 'uploads');

export const urlBaseImagens = () => (process.env.IMAGENS_URL_BASE ?? '/catalogo/imagens').replace(/\/$/, '');
