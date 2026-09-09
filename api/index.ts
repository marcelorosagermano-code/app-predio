import { createApiApp } from '../server.ts';

const app = createApiApp();

export default function handler(req: any, res: any) {
  try {
    // 1. Identificar caminho alvo com suporte a todas as variações de rewrite da Vercel
    let targetPath = '';

    // Cabeçalhos comuns injetados pelo proxy da Vercel
    const forwardedUri =
      req.headers['x-forwarded-uri'] ||
      req.headers['x-invoke-path'] ||
      req.headers['x-matched-path'];

    if (typeof forwardedUri === 'string' && forwardedUri.startsWith('/api/')) {
      targetPath = forwardedUri.split('?')[0];
    }

    // Query parameters via vercel.json (path ou slug)
    if (!targetPath) {
      const qPath = req.query?.path || req.query?.slug;
      if (qPath) {
        const subpath = Array.isArray(qPath) ? qPath.join('/') : qPath;
        targetPath = '/api/' + String(subpath).replace(/^\//, '').split('?')[0];
      }
    }

    // Inspeção direta do req.url caso venha com query string (ex: /api?path=admin/create-morador-user)
    if (!targetPath && typeof req.url === 'string') {
      try {
        const parsedUrl = new URL(req.url, 'http://localhost');
        const paramPath = parsedUrl.searchParams.get('path') || parsedUrl.searchParams.get('slug');
        if (paramPath) {
          targetPath = '/api/' + paramPath.replace(/^\//, '');
        } else if (parsedUrl.pathname.startsWith('/api/')) {
          targetPath = parsedUrl.pathname;
        }
      } catch {
        // Fallback básico
      }
    }

    if (targetPath) {
      req.url = targetPath;
    } else if (req.url) {
      if (!req.url.startsWith('/api')) {
        req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
      }
    }

    if (req.body && typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // mantém como está
      }
    }

    return app(req, res);
  } catch (err: any) {
    console.error('Erro na execução do handler da Vercel:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Erro interno na função da Vercel.',
      });
    }
  }
}

