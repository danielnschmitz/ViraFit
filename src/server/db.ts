import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { hashPassword } from './auth';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'admin',
  database: process.env.PGDATABASE || 'virafit',
});

export const DEFAULT_STUDENT_GROUPS = ['Presencial', 'Online'];

export const DEFAULT_MUSCLE_GROUPS = [
  'Abdômen',
  'Aeróbico',
  'Alongamento',
  'Antebraço',
  'Bíceps',
  'Musculação',
  'Dorsal',
  'Elástico',
  'Funcional',
  'Inferiores',
  'Laboral',
  'MAT Pilates',
  'Mobilidade',
  'Ombros',
  'Outro',
  'Em casa',
  'Peito',
  'Tríceps',
];

export const DEFAULT_EXERCISE_CATEGORIES = [
  'Musculação',
  'Aeróbico',
  'Funcional',
  'Alongamento',
  'Em casa',
  'Mobilidade',
  'Elástico',
  'MAT Pilates',
  'Laboral',
];

export const DEFAULT_EXERCISE_SCHEMES = [
  { name: '3x10', scheme_type: 'series_retas', sets: 3, reps: '10', rep_unit: 'reps', rest_time: '60', rest_unit: 'seconds' },
  { name: '3x12', scheme_type: 'series_retas', sets: 3, reps: '12', rep_unit: 'reps', rest_time: '60', rest_unit: 'seconds' },
  { name: '3x15', scheme_type: 'series_retas', sets: 3, reps: '15', rep_unit: 'reps', rest_time: '45', rest_unit: 'seconds' },
  { name: '4x10', scheme_type: 'series_retas', sets: 4, reps: '10', rep_unit: 'reps', rest_time: '60', rest_unit: 'seconds' },
  { name: '4x12', scheme_type: 'series_retas', sets: 4, reps: '12', rep_unit: 'reps', rest_time: '60', rest_unit: 'seconds' },
  { name: '3x 45 seg', scheme_type: 'series_retas', sets: 3, reps: '45', rep_unit: 'seconds', rest_time: '30', rest_unit: 'seconds' },
  { name: '3x 1 min', scheme_type: 'series_retas', sets: 3, reps: '1', rep_unit: 'minutes', rest_time: '30', rest_unit: 'seconds' },
  { name: 'Pirâmide 12-10-8-6', scheme_type: 'piramide', sets: 4, reps: '12-10-8-6', rep_unit: 'reps', rest_time: '90', rest_unit: 'seconds' },
  { name: 'Drop-set 3x10', scheme_type: 'drop_set', sets: 3, reps: '10', rep_unit: 'reps', rest_time: '60', rest_unit: 'seconds' },
  { name: 'Rest-Pause 3x10', scheme_type: 'rest_pause', sets: 3, reps: '10', rep_unit: 'reps', rest_time: '15', rest_unit: 'seconds' },
  { name: '3x Até a Falha', scheme_type: 'ate_a_falha', sets: 3, reps: 'Falha', rep_unit: 'reps', rest_time: '60', rest_unit: 'seconds' },
];

export async function seedOrganizationDefaults(orgId: string, client?: PoolClient | Pool): Promise<void> {
  const db = client || pool;

  for (const name of DEFAULT_STUDENT_GROUPS) {
    await db.query(
      `INSERT INTO student_groups (id, organization_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, name) DO NOTHING`,
      [crypto.randomUUID(), orgId, name]
    );
  }

  for (const name of DEFAULT_MUSCLE_GROUPS) {
    await db.query(
      `INSERT INTO muscle_groups (id, organization_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, name) DO NOTHING`,
      [crypto.randomUUID(), orgId, name]
    );
  }

  for (const name of DEFAULT_EXERCISE_CATEGORIES) {
    await db.query(
      `INSERT INTO exercise_categories (id, organization_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, name) DO NOTHING`,
      [crypto.randomUUID(), orgId, name]
    );
  }

  const schemesCount = await db.query(
    `SELECT COUNT(*)::int AS total FROM exercise_schemes WHERE organization_id = $1`,
    [orgId]
  );
  if (schemesCount.rows[0].total === 0) {
    for (const s of DEFAULT_EXERCISE_SCHEMES) {
      await db.query(
        `INSERT INTO exercise_schemes (id, organization_id, name, scheme_type, sets, reps, rep_unit, rest_time, rest_unit, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
         ON CONFLICT (organization_id, name) DO NOTHING`,
        [crypto.randomUUID(), orgId, s.name, s.scheme_type, s.sets, s.reps, s.rep_unit, s.rest_time, s.rest_unit]
      );
    }
  }

  // Templates de treino iniciais para testes
  await seedWorkoutTemplatesForOrg(orgId, db);
}

async function seedWorkoutTemplatesForOrg(orgId: string, db: PoolClient | Pool) {
  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM workout_templates WHERE organization_id = $1`,
    [orgId]
  );
  if (countRes.rows[0].total > 0) return;

  const exRes = await db.query(
    `SELECT id, name FROM exercises WHERE organization_id = $1`,
    [orgId]
  );
  if (exRes.rows.length === 0) return;

  const exercises = exRes.rows;
  const findEx = (pattern: string) => {
    const cleanPattern = pattern.toLowerCase();
    const found = exercises.find((e: any) => e.name.toLowerCase().includes(cleanPattern));
    return found ? found.id : exercises[0].id;
  };

  const templatesDefinitions = [
    {
      name: 'Hipertrofia ABC - Treino A (Peito, Ombros e Tríceps)',
      student_group_name: 'Todos',
      items: [
        {
          exercisePattern: 'supino reto com barra',
          scheme_type: 'piramide',
          scheme_name: 'Pirâmide 4x (12-10-8-6)',
          sets: 4,
          reps: '12-10-8-6',
          rep_unit: 'reps',
          rest_time: '90',
          rest_unit: 'seconds',
          weight: '40/50/60/70',
          notes: 'Aumentar carga progressivamente a cada série com boa cadência.',
        },
        {
          exercisePattern: 'supino inclinado com halter',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 4x10',
          sets: 4,
          reps: '10',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '24',
          notes: 'Banco a 30 graus, focar na contração do peitoral superior.',
        },
        {
          exercisePattern: 'crossover',
          scheme_type: 'drop_set',
          scheme_name: 'Drop-set 3x (10+10+10)',
          sets: 3,
          reps: '10-10-10',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '25/20/15',
          notes: 'Diminuir carga imediatamente sem descanso.',
        },
        {
          exercisePattern: 'desenvolvimento',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 4x10',
          sets: 4,
          reps: '10',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '18',
          notes: 'Controle na descida até a linha das orelhas.',
        },
        {
          exercisePattern: 'eleva',
          scheme_type: 'drop_set',
          scheme_name: 'Drop-set 3x (12+12+12)',
          sets: 3,
          reps: '12-12-12',
          rep_unit: 'reps',
          rest_time: '45',
          rest_unit: 'seconds',
          weight: '12/10/8',
          notes: 'Sem balançar o tronco, manter cotovelos semi-flexionados.',
        },
        {
          exercisePattern: 'pulley com corda',
          scheme_type: 'rest_pause',
          scheme_name: 'Rest-Pause 3x (10+5+3)',
          sets: 3,
          reps: '10+5+3',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '35',
          notes: 'Pausa de 15 segundos entre as micropausas.',
        },
        {
          exercisePattern: 'testa',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 3x12',
          sets: 3,
          reps: '12',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '20',
          notes: 'Cuidado para não abrir os cotovelos.',
        },
      ],
    },
    {
      name: 'Hipertrofia ABC - Treino B (Costas, Trapézio e Bíceps)',
      student_group_name: 'Todos',
      items: [
        {
          exercisePattern: 'puxada frontal',
          scheme_type: 'piramide',
          scheme_name: 'Pirâmide 4x (12-10-8-6)',
          sets: 4,
          reps: '12-10-8-6',
          rep_unit: 'reps',
          rest_time: '90',
          rest_unit: 'seconds',
          weight: '45/55/65/75',
          notes: 'Trazer a barra até a altura da clavícula, peito estufado.',
        },
        {
          exercisePattern: 'remada curvada',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 4x10',
          sets: 4,
          reps: '10',
          rep_unit: 'reps',
          rest_time: '75',
          rest_unit: 'seconds',
          weight: '50',
          notes: 'Coluna alinhada e tronco inclinado a 45 graus.',
        },
        {
          exercisePattern: 'serrote',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 3x12',
          sets: 3,
          reps: '12',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '26',
          notes: 'Puxar em direção ao quadril ativando dorsal.',
        },
        {
          exercisePattern: 'encolhimento',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 4x15',
          sets: 4,
          reps: '15',
          rep_unit: 'reps',
          rest_time: '45',
          rest_unit: 'seconds',
          weight: '30',
          notes: 'Pausa de 2 segundos no pico de contração superior.',
        },
        {
          exercisePattern: 'rosca direta',
          scheme_type: 'piramide',
          scheme_name: 'Pirâmide 4x (12-10-8-6)',
          sets: 4,
          reps: '12-10-8-6',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '15/20/25/30',
          notes: 'Cotovelos firmes ao lado do corpo.',
        },
        {
          exercisePattern: 'rosca martelo',
          scheme_type: 'drop_set',
          scheme_name: 'Drop-set 3x (10+10+10)',
          sets: 3,
          reps: '10-10-10',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '16/12/8',
          notes: 'Pegada neutra para enfatizar braquiorradial e bíceps braquial.',
        },
      ],
    },
    {
      name: 'Hipertrofia ABC - Treino C (Pernas Completo e Abdômen)',
      student_group_name: 'Todos',
      items: [
        {
          exercisePattern: 'agachamento livre',
          scheme_type: 'piramide',
          scheme_name: 'Pirâmide 4x (12-10-8-6)',
          sets: 4,
          reps: '12-10-8-6',
          rep_unit: 'reps',
          rest_time: '120',
          rest_unit: 'seconds',
          weight: '60/80/90/100',
          notes: 'Amplitude completa com joelhos alinhados às pontas dos pés.',
        },
        {
          exercisePattern: 'leg press 45',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 4x12',
          sets: 4,
          reps: '12',
          rep_unit: 'reps',
          rest_time: '90',
          rest_unit: 'seconds',
          weight: '180',
          notes: 'Não hiperestender os joelhos no ponto final.',
        },
        {
          exercisePattern: 'cadeira extensora',
          scheme_type: 'drop_set',
          scheme_name: 'Drop-set 3x (10+10+10)',
          sets: 3,
          reps: '10-10-10',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '50/40/30',
          notes: 'Contração isométrica de 1 segundo no topo.',
        },
        {
          exercisePattern: 'stiff com barra',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 4x10',
          sets: 4,
          reps: '10',
          rep_unit: 'reps',
          rest_time: '75',
          rest_unit: 'seconds',
          weight: '50',
          notes: 'Sentir o alongamento dos isquiotibiais, coluna reta.',
        },
        {
          exercisePattern: 'mesa flexora',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 3x12',
          sets: 3,
          reps: '12',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '35',
          notes: 'Quadril colado no banco durante toda a execução.',
        },
        {
          exercisePattern: 'panturrilha',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 4x15',
          sets: 4,
          reps: '15',
          rep_unit: 'reps',
          rest_time: '45',
          rest_unit: 'seconds',
          weight: '50',
          notes: 'Amplitude máxima tanto no alongamento quanto na contração.',
        },
        {
          exercisePattern: 'prancha',
          scheme_type: 'ate_a_falha',
          scheme_name: 'Até a Falha 3x',
          sets: 3,
          reps: 'Até a Falha',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '',
          notes: 'Abdômen e glúteos contraídos sem curvar a lombar.',
        },
        {
          exercisePattern: 'infra',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 3x15',
          sets: 3,
          reps: '15',
          rep_unit: 'reps',
          rest_time: '45',
          rest_unit: 'seconds',
          weight: '',
          notes: 'Elevar as pernas controlando o retorno sem balançar.',
        },
      ],
    },
    {
      name: 'Condicionamento Funcional & Queima Calórica',
      student_group_name: 'Todos',
      items: [
        {
          exercisePattern: 'esteira',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 1x20 min',
          sets: 1,
          reps: '20',
          rep_unit: 'minutes',
          rest_time: '0',
          rest_unit: 'seconds',
          weight: '',
          notes: 'Ritmo moderado contínuo ou intervalado leve.',
        },
        {
          exercisePattern: 'burpee',
          scheme_type: 'ate_a_falha',
          scheme_name: 'Até a Falha 4x',
          sets: 4,
          reps: 'Até a Falha',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '',
          notes: 'Execução explosiva mantendo boa postura.',
        },
        {
          exercisePattern: 'kettlebell',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 4x15',
          sets: 4,
          reps: '15',
          rep_unit: 'reps',
          rest_time: '45',
          rest_unit: 'seconds',
          weight: '16',
          notes: 'Potência gerada pelo quadril e glúteos, não pelos braços.',
        },
        {
          exercisePattern: 'flex',
          scheme_type: 'ate_a_falha',
          scheme_name: 'Até a Falha 4x',
          sets: 4,
          reps: 'Até a Falha',
          rep_unit: 'reps',
          rest_time: '60',
          rest_unit: 'seconds',
          weight: '',
          notes: 'Descer até o peito quase encostar no chão.',
        },
        {
          exercisePattern: 'bicicleta',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 3x20',
          sets: 3,
          reps: '20',
          rep_unit: 'reps',
          rest_time: '45',
          rest_unit: 'seconds',
          weight: '',
          notes: 'Cotovelo oposto toca joelho oposto com rotação do tronco.',
        },
      ],
    },
    {
      name: 'Mobilidade Articular, Pilates & Alongamento',
      student_group_name: 'Todos',
      items: [
        {
          exercisePattern: 'mobilidade tor',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 3x10',
          sets: 3,
          reps: '10',
          rep_unit: 'reps',
          rest_time: '30',
          rest_unit: 'seconds',
          weight: '',
          notes: 'Respiração profunda e controlada em cada repetição.',
        },
        {
          exercisePattern: 'rota',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 3x12',
          sets: 3,
          reps: '12',
          rep_unit: 'reps',
          rest_time: '30',
          rest_unit: 'seconds',
          weight: '',
          notes: 'Fortalecimento do manguito rotador.',
        },
        {
          exercisePattern: 'the hundred',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 3x100',
          sets: 3,
          reps: '100',
          rep_unit: 'reps',
          rest_time: '45',
          rest_unit: 'seconds',
          weight: '',
          notes: 'Contração do centro de força (powerhouse).',
        },
        {
          exercisePattern: 'alongamento de posterior',
          scheme_type: 'series_retas',
          scheme_name: 'Séries Retas 3x45 seg',
          sets: 3,
          reps: '45',
          rep_unit: 'seconds',
          rest_time: '30',
          rest_unit: 'seconds',
          weight: '',
          notes: 'Manter a posição sem dar solavancos, relaxando a musculatura.',
        },
      ],
    },
  ];

  for (const tpl of templatesDefinitions) {
    const templateId = crypto.randomUUID();
    await db.query(
      `INSERT INTO workout_templates (id, organization_id, name, student_group_name)
       VALUES ($1, $2, $3, $4)`,
      [templateId, orgId, tpl.name, tpl.student_group_name]
    );

    for (let idx = 0; idx < tpl.items.length; idx++) {
      const it = tpl.items[idx];
      const exId = findEx(it.exercisePattern);

      await db.query(
        `INSERT INTO workout_template_items (
          id, template_id, organization_id, position, exercise_id,
          scheme_id, scheme_name, scheme_type, sets, reps, rep_unit, rest_time, rest_unit, weight, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          crypto.randomUUID(),
          templateId,
          orgId,
          idx,
          exId,
          null,
          it.scheme_name,
          it.scheme_type,
          it.sets,
          it.reps,
          it.rep_unit,
          it.rest_time,
          it.rest_unit,
          it.weight || null,
          it.notes,
        ]
      );
    }
  }
  console.log(`[DB] Templates de treino semeados com sucesso para a organização ${orgId}.`);
}

async function ensureDatabaseExists(): Promise<void> {
  const targetDb = process.env.PGDATABASE || 'virafit';
  const adminPool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'admin',
    database: 'postgres',
  });
  try {
    const res = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDb]
    );
    if (res.rows.length === 0) {
      console.log(`[DB] Criando banco de dados '${targetDb}'...`);
      await adminPool.query(`CREATE DATABASE "${targetDb}"`);
    }
  } catch (err) {
    console.warn('[DB] Aviso ao verificar/criar database:', (err as Error).message);
  } finally {
    await adminPool.end();
  }
}

export async function initDatabase(): Promise<void> {
  await ensureDatabaseExists();

  const client = await pool.connect();
  try {
    console.log('[DB] Inicializando tabelas no PostgreSQL (virafit)...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(50) PRIMARY KEY,
        value JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS organizations (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        document VARCHAR(50),
        phone VARCHAR(50) NOT NULL,
        notes TEXT,
        logo TEXT,
        max_admins INTEGER NOT NULL DEFAULT 5,
        max_users INTEGER NOT NULL DEFAULT 10,
        max_students INTEGER NOT NULL DEFAULT 100,
        mod_students BOOLEAN NOT NULL DEFAULT TRUE,
        mod_exercises BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_students INTEGER NOT NULL DEFAULT 100;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS mod_students BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS mod_exercises BOOLEAN NOT NULL DEFAULT TRUE;

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(64) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'standard', -- 'master', 'admin', 'standard'
        organization_id VARCHAR(36) REFERENCES organizations(id) ON DELETE CASCADE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;

      CREATE TABLE IF NOT EXISTS student_groups (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(organization_id, name)
      );

      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        document VARCHAR(50) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        gender VARCHAR(30) NOT NULL, -- 'Masculino', 'Feminino', 'Outro'
        group_id VARCHAR(36) REFERENCES student_groups(id) ON DELETE SET NULL,
        group_name VARCHAR(150) NOT NULL,
        schedule_type VARCHAR(30) NOT NULL DEFAULT 'fixed_days', -- 'fixed_days', 'sequence'
        notes TEXT,
        email VARCHAR(255),
        zip_code VARCHAR(30),
        street VARCHAR(255),
        neighborhood VARCHAR(255),
        city VARCHAR(255),
        state VARCHAR(50),
        delivery_instructions TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE students ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(30) NOT NULL DEFAULT 'fixed_days';

      CREATE TABLE IF NOT EXISTS muscle_groups (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(organization_id, name)
      );

      CREATE TABLE IF NOT EXISTS exercise_categories (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(organization_id, name)
      );

      CREATE TABLE IF NOT EXISTS exercises (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        media_type VARCHAR(30) NOT NULL DEFAULT 'none', -- 'none', 'photo_gif', 'video', 'youtube'
        media_url TEXT,
        muscle_group_id VARCHAR(36) NOT NULL REFERENCES muscle_groups(id) ON DELETE RESTRICT,
        category_id VARCHAR(36) NOT NULL REFERENCES exercise_categories(id) ON DELETE RESTRICT,
        is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS exercise_schemes (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        scheme_type VARCHAR(40) NOT NULL DEFAULT 'series_retas', -- 'series_retas', 'piramide', 'drop_set', 'rest_pause', 'ate_a_falha'
        sets INTEGER NOT NULL DEFAULT 3,
        reps VARCHAR(100) NOT NULL DEFAULT '10',
        rep_unit VARCHAR(20) NOT NULL DEFAULT 'reps', -- 'reps', 'seconds', 'minutes'
        rest_time VARCHAR(30) DEFAULT '60',
        rest_unit VARCHAR(20) NOT NULL DEFAULT 'seconds', -- 'seconds', 'minutes'
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(organization_id, name)
      );

      ALTER TABLE exercise_schemes ADD COLUMN IF NOT EXISTS rest_time VARCHAR(30) DEFAULT '60';
      ALTER TABLE exercise_schemes ADD COLUMN IF NOT EXISTS rest_unit VARCHAR(20) NOT NULL DEFAULT 'seconds';

      CREATE TABLE IF NOT EXISTS workout_templates (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        student_group_id VARCHAR(36) REFERENCES student_groups(id) ON DELETE SET NULL,
        student_group_name VARCHAR(150) NOT NULL DEFAULT 'Todos',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workout_template_items (
        id VARCHAR(36) PRIMARY KEY,
        template_id VARCHAR(36) NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
        organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        exercise_id VARCHAR(36) NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        scheme_id VARCHAR(36) REFERENCES exercise_schemes(id) ON DELETE SET NULL,
        scheme_name VARCHAR(150) NOT NULL,
        scheme_type VARCHAR(40) NOT NULL DEFAULT 'series_retas',
        sets INTEGER NOT NULL DEFAULT 3,
        reps VARCHAR(100) NOT NULL DEFAULT '10',
        rep_unit VARCHAR(20) NOT NULL DEFAULT 'reps',
        rest_time VARCHAR(30) DEFAULT '60',
        rest_unit VARCHAR(20) NOT NULL DEFAULT 'seconds',
        weight VARCHAR(150),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE workout_template_items ADD COLUMN IF NOT EXISTS rest_time VARCHAR(30) DEFAULT '60';
      ALTER TABLE workout_template_items ADD COLUMN IF NOT EXISTS rest_unit VARCHAR(20) NOT NULL DEFAULT 'seconds';
      ALTER TABLE workout_template_items ADD COLUMN IF NOT EXISTS weight VARCHAR(150);

      CREATE TABLE IF NOT EXISTS student_workouts (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS student_workout_items (
        id VARCHAR(36) PRIMARY KEY,
        workout_id VARCHAR(36) NOT NULL REFERENCES student_workouts(id) ON DELETE CASCADE,
        organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        exercise_id VARCHAR(36) NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        scheme_id VARCHAR(36) REFERENCES exercise_schemes(id) ON DELETE SET NULL,
        scheme_name VARCHAR(150) NOT NULL,
        scheme_type VARCHAR(40) NOT NULL DEFAULT 'series_retas',
        sets INTEGER NOT NULL DEFAULT 3,
        reps VARCHAR(100) NOT NULL DEFAULT '10',
        rep_unit VARCHAR(20) NOT NULL DEFAULT 'reps',
        rest_time VARCHAR(30) DEFAULT '60',
        rest_unit VARCHAR(20) NOT NULL DEFAULT 'seconds',
        weight VARCHAR(150),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS student_scheduled_workouts (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        notes TEXT,
        schedule_type VARCHAR(30) NOT NULL DEFAULT 'fixed_days', -- 'fixed_days', 'sequence'
        day_of_week INTEGER, -- 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
        sequence_order INTEGER DEFAULT 1,
        start_date VARCHAR(20),
        end_date VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS student_scheduled_workout_items (
        id VARCHAR(36) PRIMARY KEY,
        scheduled_workout_id VARCHAR(36) NOT NULL REFERENCES student_scheduled_workouts(id) ON DELETE CASCADE,
        organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        exercise_id VARCHAR(36) NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        scheme_id VARCHAR(36) REFERENCES exercise_schemes(id) ON DELETE SET NULL,
        scheme_name VARCHAR(150) NOT NULL,
        scheme_type VARCHAR(40) NOT NULL DEFAULT 'series_retas',
        sets INTEGER NOT NULL DEFAULT 3,
        reps VARCHAR(100) NOT NULL DEFAULT '10',
        rep_unit VARCHAR(20) NOT NULL DEFAULT 'reps',
        rest_time VARCHAR(30) DEFAULT '60',
        rest_unit VARCHAR(20) NOT NULL DEFAULT 'seconds',
        weight VARCHAR(150),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
      CREATE INDEX IF NOT EXISTS idx_students_org ON students(organization_id, name);
      CREATE INDEX IF NOT EXISTS idx_muscle_groups_org ON muscle_groups(organization_id, name);
      CREATE INDEX IF NOT EXISTS idx_exercise_categories_org ON exercise_categories(organization_id, name);
      CREATE INDEX IF NOT EXISTS idx_exercises_org ON exercises(organization_id, name);
      CREATE INDEX IF NOT EXISTS idx_exercise_schemes_org ON exercise_schemes(organization_id);
      CREATE INDEX IF NOT EXISTS idx_workout_templates_org ON workout_templates(organization_id, name);
      CREATE INDEX IF NOT EXISTS idx_workout_template_items_tpl ON workout_template_items(template_id, position);
      CREATE INDEX IF NOT EXISTS idx_student_workouts_student ON student_workouts(organization_id, student_id);
      CREATE INDEX IF NOT EXISTS idx_student_workout_items_wk ON student_workout_items(workout_id, position);
      CREATE INDEX IF NOT EXISTS idx_student_scheduled_wk_student ON student_scheduled_workouts(organization_id, student_id);
      CREATE INDEX IF NOT EXISTS idx_student_scheduled_items_wk ON student_scheduled_workout_items(scheduled_workout_id, position);
    `);

    // Garantir criação do usuário Master padrão ('master' / 'admin123')
    const masterCheck = await client.query(
      `SELECT id FROM users WHERE role = 'master' LIMIT 1`
    );

    if (masterCheck.rows.length === 0) {
      const id = crypto.randomUUID();
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword('admin123', salt);
      await client.query(
        `INSERT INTO users (id, username, name, email, password_hash, salt, role, organization_id, must_change_password)
         VALUES ($1, $2, $3, $4, $5, $6, 'master', NULL, TRUE)`,
        [id, 'master', 'Administrador Master', 'master@virafit.dev', passwordHash, salt]
      );
      console.log('[DB] Usuário Master padrão criado: login "master" / senha "admin123"');
    }

    // Garantir que todas as organizações existentes tenham grupos e categorias padrões
    const orgsRes = await client.query(`SELECT id FROM organizations`);
    for (const row of orgsRes.rows) {
      await seedOrganizationDefaults(row.id, client);
    }

    console.log('[DB] Tabelas inicializadas com sucesso.');
  } finally {
    client.release();
  }
}
