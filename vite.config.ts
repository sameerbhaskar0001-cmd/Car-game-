import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const GSTATIC_MODELS_BASE = 'https://www.gstatic.com/aistudio/starter-apps/desk-racer/models';
const GLB_FILES = [
  'desk_props.glb',
  'kart_1to87.glb',
  'room_environment.glb',
  'track_coaster.glb',
];

function fetchGstaticModelsOnBuild(): Plugin {
  let outDir = 'dist';
  return {
    name: 'fetch-gstatic-models-on-build',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir || 'dist';
    },
    async closeBundle() {
      const assetsModelsDir = path.resolve(outDir, 'assets/models');
      const apiModelsDir = path.resolve(outDir, 'api/gstatic-models');
      await Promise.all([
        fs.mkdir(assetsModelsDir, { recursive: true }),
        fs.mkdir(apiModelsDir, { recursive: true }),
      ]);

      await Promise.all(
        GLB_FILES.map(async (file) => {
          const url = `${GSTATIC_MODELS_BASE}/${file}`;
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
          }
          const buffer = Buffer.from(await res.arrayBuffer());
          await Promise.all([
            fs.writeFile(path.join(assetsModelsDir, file), buffer),
            fs.writeFile(path.join(apiModelsDir, file), buffer),
          ]);
        })
      );
    },
  };
}

const gstaticModelsProxy = {
  '/api/gstatic-models': {
    target: 'https://www.gstatic.com',
    changeOrigin: true,
    rewrite: (reqPath: string) =>
      reqPath.replace(/^\/api\/gstatic-models/, '/aistudio/starter-apps/desk-racer/models'),
  },
  '/assets/models': {
    target: 'https://www.gstatic.com',
    changeOrigin: true,
    rewrite: (reqPath: string) =>
      reqPath.replace(/^\/assets\/models/, '/aistudio/starter-apps/desk-racer/models'),
  },
};

function oxionApiPlugin(): Plugin {
  return {
    name: 'oxion-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();

        if (req.url === '/api/oxion/health' && req.method === 'GET') {
          const key = process.env.OXION_API_KEY || '';
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'ok',
              configured: Boolean(key),
              keyPreview: key ? `${key.slice(0, 5)}... (len ${key.length})` : 'none',
              model: 'claude-opus-5.5',
              baseURL: process.env.OXION_BASE_URL || 'https://www.oxionai.com/v1',
            })
          );
          return;
        }

        if (req.url === '/api/oxion/chat' && req.method === 'POST') {
          try {
            let body = '';
            for await (const chunk of req) {
              body += chunk;
            }
            const data = body ? JSON.parse(body) : {};
            const messages = data.messages || [
              ...(data.system ? [{ role: 'system', content: data.system }] : []),
              { role: 'user', content: data.prompt || 'Hello' },
            ];
            const targetModel = data.model || 'claude-opus-5.5';

            const { OpenAI } = await import('openai');
            const apiKey = process.env.OXION_API_KEY || '';
            const baseURL = process.env.OXION_BASE_URL || 'https://www.oxionai.com/v1';

            const client = new OpenAI({ apiKey, baseURL });
            const completion = await client.chat.completions.create({
              model: targetModel,
              messages,
              temperature: data.temperature ?? 0.7,
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                content: completion.choices[0]?.message?.content || '',
                model: targetModel,
                id: completion.id,
              })
            );
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: err?.message || 'Oxion API request failed',
              })
            );
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), fetchGstaticModelsOnBuild(), oxionApiPlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: gstaticModelsProxy,
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    proxy: gstaticModelsProxy,
  },
});
