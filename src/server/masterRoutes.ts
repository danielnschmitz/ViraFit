import { Router } from 'express';
import crypto from 'crypto';
import { pool, seedOrganizationDefaults } from './db';
import { AuthRequest, authenticateToken, hashPassword, requireMaster } from './auth';

export const masterRouter = Router();

masterRouter.use(authenticateToken);

// 1. Listar todas as organizações (Master apenas)
masterRouter.get('/organizations', requireMaster, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*,
        (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id AND u.role = 'admin') AS admin_count,
        (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id AND u.role = 'standard') AS standard_count,
        (SELECT COUNT(*)::int FROM students s WHERE s.organization_id = o.id) AS students_count,
        (SELECT COUNT(*)::int FROM exercises e WHERE e.organization_id = o.id) AS exercises_count
      FROM organizations o
      ORDER BY o.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[Master] Erro ao listar organizações:', err);
    res.status(500).json({ error: 'Erro ao listar organizações.' });
  }
});

// 2. Criar organização (Master apenas)
masterRouter.post('/organizations', requireMaster, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      name,
      document,
      phone,
      notes,
      logo,
      max_admins,
      max_users,
      max_students,
      mod_students,
      mod_exercises,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O Nome da organização é obrigatório.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'O Telefone da organização é obrigatório.' });
    }

    await client.query('BEGIN');

    const id = crypto.randomUUID();
    const result = await client.query(
      `INSERT INTO organizations (
        id, name, document, phone, notes, logo,
        max_admins, max_users, max_students, mod_students, mod_exercises
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        id,
        name.trim(),
        document || null,
        phone.trim(),
        notes || null,
        logo || null,
        Number(max_admins ?? 5),
        Number(max_users ?? 10),
        Number(max_students ?? 100),
        mod_students !== undefined ? Boolean(mod_students) : true,
        mod_exercises !== undefined ? Boolean(mod_exercises) : true,
      ]
    );

    // Semear grupos de alunos, grupos musculares e categorias de exercício padrão
    await seedOrganizationDefaults(id, client);

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Master] Erro ao criar organização:', err);
    res.status(500).json({ error: 'Erro ao criar organização.' });
  } finally {
    client.release();
  }
});

// 3. Atualizar organização (Master apenas)
masterRouter.put('/organizations/:id', requireMaster, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      document,
      phone,
      notes,
      logo,
      max_admins,
      max_users,
      max_students,
      mod_students,
      mod_exercises,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O Nome da organização é obrigatório.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'O Telefone da organização é obrigatório.' });
    }

    const result = await pool.query(
      `UPDATE organizations SET
        name = $1, document = $2, phone = $3, notes = $4, logo = $5,
        max_admins = $6, max_users = $7, max_students = $8,
        mod_students = $9, mod_exercises = $10,
        updated_at = NOW()
      WHERE id = $11
      RETURNING *`,
      [
        name.trim(),
        document || null,
        phone.trim(),
        notes || null,
        logo || null,
        Number(max_admins ?? 5),
        Number(max_users ?? 10),
        Number(max_students ?? 100),
        mod_students !== undefined ? Boolean(mod_students) : true,
        mod_exercises !== undefined ? Boolean(mod_exercises) : true,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organização não encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Master] Erro ao atualizar organização:', err);
    res.status(500).json({ error: 'Erro ao atualizar organização.' });
  }
});

// 4. Excluir organização (Master apenas)
masterRouter.delete('/organizations/:id', requireMaster, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [id]);
    res.json({ message: 'Organização excluída com sucesso.' });
  } catch (err) {
    console.error('[Master] Erro ao excluir organização:', err);
    res.status(500).json({ error: 'Erro ao excluir organização.' });
  }
});

// 5. Métricas de uso gerais no Painel Master (com filtro opcional por organization_id)
masterRouter.get('/metrics', requireMaster, async (req, res) => {
  try {
    const orgId = typeof req.query.organization_id === 'string' && req.query.organization_id.trim() !== ''
      ? req.query.organization_id.trim()
      : null;

    const orgFilter = orgId ? `WHERE id = $1` : ``;
    const subFilter = orgId ? `WHERE organization_id = $1` : ``;
    const params = orgId ? [orgId] : [];

    const [orgsRes, usersRes, studentsRes, exercisesRes, groupsRes, catsRes, breakdownRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM organizations ${orgFilter}`, params),
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE role != 'master')::int AS total_users,
          COUNT(*) FILTER (WHERE role = 'admin')::int AS total_admins,
          COUNT(*) FILTER (WHERE role = 'standard')::int AS total_standards
         FROM users ${subFilter}`,
        params
      ),
      pool.query(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE LOWER(group_name) = 'presencial')::int AS presencial,
          COUNT(*) FILTER (WHERE LOWER(group_name) = 'online')::int AS online
         FROM students ${subFilter}`,
        params
      ),
      pool.query(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_favorite = TRUE)::int AS favorites,
          COUNT(*) FILTER (WHERE media_type != 'none' AND media_url IS NOT NULL AND media_url != '')::int AS with_media
         FROM exercises ${subFilter}`,
        params
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM muscle_groups ${subFilter}`, params),
      pool.query(`SELECT COUNT(*)::int AS total FROM exercise_categories ${subFilter}`, params),
      pool.query(
        `SELECT
          o.id, o.name, o.phone, o.document, o.logo,
          o.max_admins, o.max_users, o.max_students,
          o.mod_students, o.mod_exercises,
          (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id AND u.role = 'admin') AS admins,
          (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id AND u.role = 'standard') AS standards,
          (SELECT COUNT(*)::int FROM students s WHERE s.organization_id = o.id) AS students,
          (SELECT COUNT(*)::int FROM exercises e WHERE e.organization_id = o.id) AS exercises,
          (SELECT COUNT(*)::int FROM muscle_groups mg WHERE mg.organization_id = o.id) AS muscle_groups,
          (SELECT COUNT(*)::int FROM exercise_categories ec WHERE ec.organization_id = o.id) AS categories
         FROM organizations o
         ${orgFilter}
         ORDER BY o.name ASC`,
        params
      ),
    ]);

    res.json({
      summary: {
        organizations: orgsRes.rows[0].total,
        users: usersRes.rows[0],
        students: studentsRes.rows[0],
        exercises: exercisesRes.rows[0],
        muscle_groups: groupsRes.rows[0].total,
        categories: catsRes.rows[0].total,
      },
      organizationsBreakdown: breakdownRes.rows,
    });
  } catch (err) {
    console.error('[Master] Erro ao carregar métricas:', err);
    res.status(500).json({ error: 'Erro ao carregar métricas do painel master.' });
  }
});

// ============================================================================
// GESTÃO DE USUÁRIOS (Master pode gerir qualquer org, Admin pode gerir apenas a sua própria org)
// ============================================================================

masterRouter.get('/users', async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    if (user.role === 'standard') {
      return res.status(403).json({ error: 'Apenas administradores podem gerenciar usuários.' });
    }

    let targetOrgId = req.activeOrgId;
    if (user.role === 'master') {
      const qOrg = typeof req.query.organization_id === 'string' ? req.query.organization_id : null;
      if (qOrg !== null) {
        targetOrgId = qOrg || null;
      }
    } else {
      targetOrgId = user.organization_id;
    }

    if (user.role === 'master' && !targetOrgId) {
      const result = await pool.query(`
        SELECT u.id, u.username, u.name, u.email, u.role, u.organization_id, u.active, u.created_at,
               o.name AS organization_name
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        ORDER BY u.role = 'master' DESC, o.name ASC NULLS FIRST, u.name ASC
      `);
      return res.json(result.rows);
    }

    const result = await pool.query(
      `SELECT u.id, u.username, u.name, u.email, u.role, u.organization_id, u.active, u.created_at,
              o.name AS organization_name
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.organization_id = $1
       ORDER BY u.role ASC, u.name ASC`,
      [targetOrgId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Users] Erro ao listar usuários:', err);
    res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
});

masterRouter.post('/users', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    if (currentUser.role === 'standard') {
      return res.status(403).json({ error: 'Apenas administradores podem criar usuários.' });
    }

    const { username, name, email, password, role, organization_id } = req.body;
    if (!username || !username.trim() || !name || !name.trim() || !password) {
      return res.status(400).json({ error: 'Login, Nome e Senha são obrigatórios.' });
    }

    const targetRole = role === 'admin' ? 'admin' : 'standard';
    const targetOrgId = currentUser.role === 'master' ? (organization_id || req.activeOrgId) : currentUser.organization_id;

    if (!targetOrgId) {
      return res.status(400).json({ error: 'Selecione a organização à qual o usuário pertencerá.' });
    }

    // Verificar limites de usuários na organização
    const orgRes = await pool.query(`SELECT * FROM organizations WHERE id = $1`, [targetOrgId]);
    if (orgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Organização não encontrada.' });
    }
    const org = orgRes.rows[0];

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM users WHERE organization_id = $1 AND role = $2`,
      [targetOrgId, targetRole]
    );
    const currentCount = countRes.rows[0].total;

    if (targetRole === 'admin' && currentCount >= org.max_admins) {
      return res.status(400).json({
        error: `Limite de usuários administradores atingido para esta organização (máx: ${org.max_admins}).`,
      });
    }
    if (targetRole === 'standard' && currentCount >= org.max_users) {
      return res.status(400).json({
        error: `Limite de usuários padrão atingido para esta organização (máx: ${org.max_users}).`,
      });
    }

    // Verificar duplicidade de username
    const dupRes = await pool.query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, [
      username.trim(),
    ]);
    if (dupRes.rows.length > 0) {
      return res.status(400).json({ error: 'Já existe um usuário com este login.' });
    }

    const id = crypto.randomUUID();
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const insertRes = await pool.query(
      `INSERT INTO users (id, username, name, email, password_hash, salt, role, organization_id, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       RETURNING id, username, name, email, role, organization_id, active, created_at`,
      [id, username.trim(), name.trim(), email || null, passwordHash, salt, targetRole, targetOrgId]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('[Users] Erro ao criar usuário:', err);
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
});

masterRouter.put('/users/:id', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    if (currentUser.role === 'standard') {
      return res.status(403).json({ error: 'Apenas administradores podem editar usuários.' });
    }

    const { id } = req.params;
    const { username, name, email, password, role, active, organization_id } = req.body;

    const existingRes = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const existing = existingRes.rows[0];

    if (existing.role === 'master' && currentUser.role !== 'master') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    if (currentUser.role !== 'master' && existing.organization_id !== currentUser.organization_id) {
      return res.status(403).json({ error: 'Você só pode editar usuários da sua própria organização.' });
    }

    const targetOrgId =
      currentUser.role === 'master' && organization_id !== undefined
        ? organization_id
        : existing.organization_id;

    const targetRole =
      existing.role === 'master' ? 'master' : role === 'admin' ? 'admin' : 'standard';

    // Se mudou de papel ou de organização, verificar limites da organização
    if (
      targetRole !== 'master' &&
      targetOrgId &&
      (targetRole !== existing.role || targetOrgId !== existing.organization_id)
    ) {
      const orgRes = await pool.query(`SELECT * FROM organizations WHERE id = $1`, [targetOrgId]);
      if (orgRes.rows.length > 0) {
        const org = orgRes.rows[0];
        const countRes = await pool.query(
          `SELECT COUNT(*)::int AS total FROM users WHERE organization_id = $1 AND role = $2 AND id != $3`,
          [targetOrgId, targetRole, id]
        );
        const currentCount = countRes.rows[0].total;
        if (targetRole === 'admin' && currentCount >= org.max_admins) {
          return res.status(400).json({
            error: `Limite de usuários administradores atingido (${org.max_admins}).`,
          });
        }
        if (targetRole === 'standard' && currentCount >= org.max_users) {
          return res.status(400).json({
            error: `Limite de usuários padrão atingido (${org.max_users}).`,
          });
        }
      }
    }

    // Verificar duplicidade de username
    if (username && username.trim().toLowerCase() !== existing.username.toLowerCase()) {
      const dupRes = await pool.query(
        `SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2`,
        [username.trim(), id]
      );
      if (dupRes.rows.length > 0) {
        return res.status(400).json({ error: 'Já existe outro usuário com este login.' });
      }
    }

    let salt = existing.salt;
    let passwordHash = existing.password_hash;
    if (password && password.trim() !== '') {
      salt = crypto.randomBytes(16).toString('hex');
      passwordHash = hashPassword(password, salt);
    }

    const updateRes = await pool.query(
      `UPDATE users SET
        username = $1,
        name = $2,
        email = $3,
        password_hash = $4,
        salt = $5,
        role = $6,
        organization_id = $7,
        active = $8,
        updated_at = NOW()
       WHERE id = $9
       RETURNING id, username, name, email, role, organization_id, active, created_at`,
      [
        username ? username.trim() : existing.username,
        name ? name.trim() : existing.name,
        email !== undefined ? email : existing.email,
        passwordHash,
        salt,
        targetRole,
        targetRole === 'master' ? null : targetOrgId,
        active !== undefined ? Boolean(active) : existing.active,
        id,
      ]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('[Users] Erro ao atualizar usuário:', err);
    res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
});

masterRouter.delete('/users/:id', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    if (currentUser.role === 'standard') {
      return res.status(403).json({ error: 'Apenas administradores podem excluir usuários.' });
    }

    const { id } = req.params;
    const existingRes = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const existing = existingRes.rows[0];

    if (existing.role === 'master') {
      return res.status(400).json({ error: 'O usuário Master principal não pode ser excluído.' });
    }

    if (currentUser.role !== 'master' && existing.organization_id !== currentUser.organization_id) {
      return res.status(403).json({ error: 'Você só pode excluir usuários da sua própria organização.' });
    }

    await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
    res.json({ message: 'Usuário excluído com sucesso.' });
  } catch (err) {
    console.error('[Users] Erro ao excluir usuário:', err);
    res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
});
