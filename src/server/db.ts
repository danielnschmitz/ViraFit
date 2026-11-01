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
  { name: '3x10', scheme_type: 'series_retas', sets: 3, reps: '10', rep_unit: 'reps' },
  { name: '3x12', scheme_type: 'series_retas', sets: 3, reps: '12', rep_unit: 'reps' },
  { name: '3x15', scheme_type: 'series_retas', sets: 3, reps: '15', rep_unit: 'reps' },
  { name: '4x10', scheme_type: 'series_retas', sets: 4, reps: '10', rep_unit: 'reps' },
  { name: '4x12', scheme_type: 'series_retas', sets: 4, reps: '12', rep_unit: 'reps' },
  { name: '3x 45 seg', scheme_type: 'series_retas', sets: 3, reps: '45', rep_unit: 'seconds' },
  { name: '3x 1 min', scheme_type: 'series_retas', sets: 3, reps: '1', rep_unit: 'minutes' },
  { name: 'Pirâmide 12-10-8-6', scheme_type: 'piramide', sets: 4, reps: '12-10-8-6', rep_unit: 'reps' },
  { name: 'Drop-set 3x10', scheme_type: 'drop_set', sets: 3, reps: '10', rep_unit: 'reps' },
  { name: 'Rest-Pause 3x10', scheme_type: 'rest_pause', sets: 3, reps: '10', rep_unit: 'reps' },
  { name: '3x Até a Falha', scheme_type: 'ate_a_falha', sets: 3, reps: 'Falha', rep_unit: 'reps' },
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
        `INSERT INTO exercise_schemes (id, organization_id, name, scheme_type, sets, reps, rep_unit, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
         ON CONFLICT (organization_id, name) DO NOTHING`,
        [crypto.randomUUID(), orgId, s.name, s.scheme_type, s.sets, s.reps, s.rep_unit]
      );
    }
  }
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
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(organization_id, name)
      );

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
