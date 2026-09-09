import { createApiApp } from '../server.ts';

const app = createApiApp();

export default function handler(req: any, res: any) {
  // 1. Tentar obter o caminho completo a partir dos cabeçalhos da Vercel
  const forwardedUri = req.headers['x-forwarded-uri'] || 
                       req.headers['x-invoke-path'] || 
                       req.headers['x-matched-path'];
                       
  if (forwardedUri && typeof forwardedUri === 'string' && forwardedUri.startsWith('/api/')) {
    req.url = forwardedUri;
  } else if (req.query && req.query.slug) {
    const subpath = Array.isArray(req.query.slug) ? req.query.slug.join('/') : req.query.slug;
    req.url = '/api/' + subpath.replace(/^\//, '');
  } else if (req.query && req.query.path) {
    const subpath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    req.url = '/api/' + subpath.replace(/^\//, '');
  } else if (req.url) {
    if (!req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
  }

  return app(req, res);
}

