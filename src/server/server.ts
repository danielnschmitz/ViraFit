import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { pool, initDatabase } from './db';
import { authRouter } from './authRoutes';
import { masterRouter } from './masterRoutes';
import { orgRouter } from './orgRoutes';

const app = express();
const PORT = process.env.PORT || 3336;

app.use(cors());
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

// Servir uploads de fotos/GIFs e vídeos de exercícios
const uploadsPath = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Rotas da API
app.use('/api/auth', authRouter);
app.use('/api/master', masterRouter);
app.use('/api/org', orgRouter);

// Servir arquivos estáticos caso compilados
const clientDistPath = path.resolve(process.cwd(), 'dist/client');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
} else {
  app.get('/', (_req, res) => {
    res.send('Servidor ViraFit API em execução. Execute `npm run dev` para usar a interface web.');
  });
}

async function bootstrap() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`\n==================================================`);
      console.log(`  💪 ViraFit Servidor Web rodando em:`);
      console.log(`  👉 http://localhost:${PORT}`);
      console.log(`==================================================\n`);
    });
  } catch (err) {
    console.error('[Server] Falha fatal ao inicializar servidor:', err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

bootstrap();
