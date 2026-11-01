import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pool } from './db';
import { AuthRequest, authenticateToken, requireOrgContext } from './auth';

export const orgRouter = Router();

orgRouter.use(authenticateToken);
orgRouter.use(requireOrgContext);

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function saveBase64MediaToFile(dataUrl: string, orgId: string): string {
  // Se já for uma URL pública/caminho salvo ou link externo, retorna como está
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  const matches = dataUrl.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return dataUrl;
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  let ext = 'bin';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('gif')) ext = 'gif';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('mp4')) ext = 'mp4';
  else if (mimeType.includes('webm')) ext = 'webm';
  else if (mimeType.includes('quicktime') || mimeType.includes('mov')) ext = 'mov';

  const orgFolder = path.join(uploadsDir, orgId);
  if (!fs.existsSync(orgFolder)) {
    fs.mkdirSync(orgFolder, { recursive: true });
  }

  const filename = `${crypto.randomUUID()}.${ext}`;
  const filePath = path.join(orgFolder, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/${orgId}/${filename}`;
}

function removeUploadedFileIfLocal(mediaUrl?: string | null) {
  if (!mediaUrl || !mediaUrl.startsWith('/uploads/')) return;
  try {
    const rel = mediaUrl.replace(/^\/uploads\//, '');
    const fullPath = path.join(uploadsDir, rel);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.warn('[Uploads] Aviso ao remover arquivo antigo:', err);
  }
}

// ============================================================================
// RESUMO DA ORGANIZAÇÃO (Dashboard Rápido)
// ============================================================================
orgRouter.get('/summary', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const [orgRes, studentsRes, exercisesRes, groupsRes, categoriesRes, studentGroupsRes] = await Promise.all([
      pool.query(`SELECT * FROM organizations WHERE id = $1`, [orgId]),
      pool.query(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE LOWER(group_name) = 'presencial')::int AS presencial,
          COUNT(*) FILTER (WHERE LOWER(group_name) = 'online')::int AS online
         FROM students WHERE organization_id = $1`,
        [orgId]
      ),
      pool.query(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_favorite = TRUE)::int AS favorites,
          COUNT(*) FILTER (WHERE media_type = 'photo_gif')::int AS photos,
          COUNT(*) FILTER (WHERE media_type = 'video')::int AS videos,
          COUNT(*) FILTER (WHERE media_type = 'youtube')::int AS youtube
         FROM exercises WHERE organization_id = $1`,
        [orgId]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM muscle_groups WHERE organization_id = $1`, [orgId]),
      pool.query(`SELECT COUNT(*)::int AS total FROM exercise_categories WHERE organization_id = $1`, [orgId]),
      pool.query(
        `SELECT group_name, COUNT(*)::int AS count
         FROM students
         WHERE organization_id = $1
         GROUP BY group_name
         ORDER BY count DESC, group_name ASC`,
        [orgId]
      ),
    ]);

    res.json({
      organization: orgRes.rows[0] || null,
      students: studentsRes.rows[0],
      studentsByGroup: studentGroupsRes.rows,
      exercises: exercisesRes.rows[0],
      muscle_groups_count: groupsRes.rows[0].total,
      categories_count: categoriesRes.rows[0].total,
    });
  } catch (err) {
    console.error('[Org] Erro ao carregar resumo:', err);
    res.status(500).json({ error: 'Erro ao carregar resumo da organização.' });
  }
});

// ============================================================================
// 1. MÓDULO - GESTÃO DE ALUNOS
// ============================================================================

// 1.0 Grupos de Aluno (Por padrão: Presencial e Online + novos grupos criados)
orgRouter.get('/student-groups', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const result = await pool.query(
      `SELECT sg.*,
              (SELECT COUNT(*)::int FROM students s WHERE s.organization_id = sg.organization_id AND (s.group_id = sg.id OR LOWER(s.group_name) = LOWER(sg.name))) AS students_count
       FROM student_groups sg
       WHERE sg.organization_id = $1
       ORDER BY sg.name = 'Presencial' DESC, sg.name = 'Online' DESC, sg.name ASC`,
      [orgId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[StudentGroups] Erro ao listar grupos de alunos:', err);
    res.status(500).json({ error: 'Erro ao listar grupos de alunos.' });
  }
});

orgRouter.post('/student-groups', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Informe o nome do grupo.' });
    }

    const cleanName = name.trim();
    const existing = await pool.query(
      `SELECT * FROM student_groups WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
      [orgId, cleanName]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Já existe um grupo com este nome.' });
    }

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO student_groups (id, organization_id, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, orgId, cleanName]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[StudentGroups] Erro ao criar grupo:', err);
    res.status(500).json({ error: 'Erro ao cadastrar grupo de alunos.' });
  }
});

// 1.1 Cadastro de Alunos
orgRouter.get('/students', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const result = await pool.query(
      `SELECT * FROM students
       WHERE organization_id = $1
       ORDER BY name ASC`,
      [orgId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Students] Erro ao listar alunos:', err);
    res.status(500).json({ error: 'Erro ao listar alunos.' });
  }
});

orgRouter.post('/students', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const {
      name,
      document,
      phone,
      gender,
      group_id,
      group_name,
      notes,
      email,
      zip_code,
      street,
      neighborhood,
      city,
      state,
      delivery_instructions,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O Nome do aluno é obrigatório.' });
    }
    if (!document || !document.trim()) {
      return res.status(400).json({ error: 'O CPF/CNPJ do aluno é obrigatório.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'O Telefone do aluno é obrigatório.' });
    }
    if (!gender || !['Masculino', 'Feminino', 'Outro'].includes(gender)) {
      return res.status(400).json({ error: 'Selecione um Gênero válido (Masculino, Feminino ou Outro).' });
    }

    // Verificar limite de alunos da organização
    const orgRes = await pool.query(`SELECT max_students FROM organizations WHERE id = $1`, [orgId]);
    if (orgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Organização não encontrada.' });
    }
    const maxStudents = orgRes.rows[0].max_students ?? 100;

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM students WHERE organization_id = $1`,
      [orgId]
    );
    if (countRes.rows[0].total >= maxStudents) {
      return res.status(400).json({
        error: `Limite de alunos atingido para esta organização (máx: ${maxStudents}).`,
      });
    }

    // Resolver group_id e group_name
    let resolvedGroupId: string | null = group_id || null;
    let resolvedGroupName: string = group_name ? group_name.trim() : '';

    if (resolvedGroupId) {
      const gRes = await pool.query(
        `SELECT id, name FROM student_groups WHERE id = $1 AND organization_id = $2`,
        [resolvedGroupId, orgId]
      );
      if (gRes.rows.length > 0) {
        resolvedGroupName = gRes.rows[0].name;
      }
    } else if (resolvedGroupName) {
      const gRes = await pool.query(
        `SELECT id, name FROM student_groups WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
        [orgId, resolvedGroupName]
      );
      if (gRes.rows.length > 0) {
        resolvedGroupId = gRes.rows[0].id;
        resolvedGroupName = gRes.rows[0].name;
      } else {
        const newGroupId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO student_groups (id, organization_id, name) VALUES ($1, $2, $3)`,
          [newGroupId, orgId, resolvedGroupName]
        );
        resolvedGroupId = newGroupId;
      }
    }

    if (!resolvedGroupName) {
      return res.status(400).json({ error: 'O Grupo do aluno é obrigatório.' });
    }

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO students (
        id, organization_id, name, document, phone, gender, group_id, group_name,
        notes, email, zip_code, street, neighborhood, city, state, delivery_instructions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        id,
        orgId,
        name.trim(),
        document.trim(),
        phone.trim(),
        gender,
        resolvedGroupId,
        resolvedGroupName,
        notes || null,
        email || null,
        zip_code || null,
        street || null,
        neighborhood || null,
        city || null,
        state || null,
        delivery_instructions || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Students] Erro ao cadastrar aluno:', err);
    res.status(500).json({ error: 'Erro ao cadastrar aluno.' });
  }
});

orgRouter.put('/students/:id', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { id } = req.params;
    const {
      name,
      document,
      phone,
      gender,
      group_id,
      group_name,
      notes,
      email,
      zip_code,
      street,
      neighborhood,
      city,
      state,
      delivery_instructions,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O Nome do aluno é obrigatório.' });
    }
    if (!document || !document.trim()) {
      return res.status(400).json({ error: 'O CPF/CNPJ do aluno é obrigatório.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'O Telefone do aluno é obrigatório.' });
    }
    if (!gender || !['Masculino', 'Feminino', 'Outro'].includes(gender)) {
      return res.status(400).json({ error: 'Selecione um Gênero válido (Masculino, Feminino ou Outro).' });
    }

    let resolvedGroupId: string | null = group_id || null;
    let resolvedGroupName: string = group_name ? group_name.trim() : '';

    if (resolvedGroupId) {
      const gRes = await pool.query(
        `SELECT id, name FROM student_groups WHERE id = $1 AND organization_id = $2`,
        [resolvedGroupId, orgId]
      );
      if (gRes.rows.length > 0) {
        resolvedGroupName = gRes.rows[0].name;
      }
    } else if (resolvedGroupName) {
      const gRes = await pool.query(
        `SELECT id, name FROM student_groups WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
        [orgId, resolvedGroupName]
      );
      if (gRes.rows.length > 0) {
        resolvedGroupId = gRes.rows[0].id;
        resolvedGroupName = gRes.rows[0].name;
      } else {
        const newGroupId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO student_groups (id, organization_id, name) VALUES ($1, $2, $3)`,
          [newGroupId, orgId, resolvedGroupName]
        );
        resolvedGroupId = newGroupId;
      }
    }

    if (!resolvedGroupName) {
      return res.status(400).json({ error: 'O Grupo do aluno é obrigatório.' });
    }

    const result = await pool.query(
      `UPDATE students SET
        name = $1, document = $2, phone = $3, gender = $4,
        group_id = $5, group_name = $6, notes = $7, email = $8,
        zip_code = $9, street = $10, neighborhood = $11, city = $12, state = $13,
        delivery_instructions = $14, updated_at = NOW()
       WHERE id = $15 AND organization_id = $16
       RETURNING *`,
      [
        name.trim(),
        document.trim(),
        phone.trim(),
        gender,
        resolvedGroupId,
        resolvedGroupName,
        notes || null,
        email || null,
        zip_code || null,
        street || null,
        neighborhood || null,
        city || null,
        state || null,
        delivery_instructions || null,
        id,
        orgId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aluno não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Students] Erro ao atualizar aluno:', err);
    res.status(500).json({ error: 'Erro ao atualizar aluno.' });
  }
});

orgRouter.delete('/students/:id', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { id } = req.params;
    await pool.query(`DELETE FROM students WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    res.json({ message: 'Aluno excluído com sucesso.' });
  } catch (err) {
    console.error('[Students] Erro ao excluir aluno:', err);
    res.status(500).json({ error: 'Erro ao excluir aluno.' });
  }
});

// ============================================================================
// 2. MÓDULO - EXERCÍCIOS
// ============================================================================

// 2.1 Cadastro de Grupo Muscular
orgRouter.get('/muscle-groups', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const result = await pool.query(
      `SELECT mg.*,
              (SELECT COUNT(*)::int FROM exercises e WHERE e.muscle_group_id = mg.id) AS exercises_count
       FROM muscle_groups mg
       WHERE mg.organization_id = $1
       ORDER BY mg.name ASC`,
      [orgId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[MuscleGroups] Erro ao listar grupos musculares:', err);
    res.status(500).json({ error: 'Erro ao listar grupos musculares.' });
  }
});

orgRouter.post('/muscle-groups', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Informe o nome do grupo muscular.' });
    }

    const cleanName = name.trim();
    const dup = await pool.query(
      `SELECT id FROM muscle_groups WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
      [orgId, cleanName]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: 'Já existe um grupo muscular com este nome.' });
    }

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO muscle_groups (id, organization_id, name)
       VALUES ($1, $2, $3)
       RETURNING *, 0 AS exercises_count`,
      [id, orgId, cleanName]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[MuscleGroups] Erro ao criar grupo muscular:', err);
    res.status(500).json({ error: 'Erro ao cadastrar grupo muscular.' });
  }
});

orgRouter.put('/muscle-groups/:id', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Informe o nome do grupo muscular.' });
    }

    const cleanName = name.trim();
    const dup = await pool.query(
      `SELECT id FROM muscle_groups WHERE organization_id = $1 AND LOWER(name) = LOWER($2) AND id != $3`,
      [orgId, cleanName, id]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: 'Já existe outro grupo muscular com este nome.' });
    }

    const result = await pool.query(
      `UPDATE muscle_groups SET name = $1
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [cleanName, id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Grupo muscular não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[MuscleGroups] Erro ao editar grupo muscular:', err);
    res.status(500).json({ error: 'Erro ao editar grupo muscular.' });
  }
});

orgRouter.delete('/muscle-groups/:id', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { id } = req.params;

    const childCheck = await pool.query(
      `SELECT COUNT(*)::int AS total FROM exercises WHERE muscle_group_id = $1 AND organization_id = $2`,
      [id, orgId]
    );
    if (childCheck.rows[0].total > 0) {
      return res.status(400).json({
        error: `Não é possível excluir este grupo muscular pois existem ${childCheck.rows[0].total} exercício(s) vinculado(s) a ele.`,
      });
    }

    const del = await pool.query(
      `DELETE FROM muscle_groups WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    );
    if (del.rows.length === 0) {
      return res.status(404).json({ error: 'Grupo muscular não encontrado.' });
    }

    res.json({ message: 'Grupo muscular excluído com sucesso.' });
  } catch (err) {
    console.error('[MuscleGroups] Erro ao excluir grupo muscular:', err);
    res.status(500).json({ error: 'Erro ao excluir grupo muscular.' });
  }
});

// 2.2 Cadastro de Categoria de Exercício
orgRouter.get('/exercise-categories', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const result = await pool.query(
      `SELECT ec.*,
              (SELECT COUNT(*)::int FROM exercises e WHERE e.category_id = ec.id) AS exercises_count
       FROM exercise_categories ec
       WHERE ec.organization_id = $1
       ORDER BY ec.name ASC`,
      [orgId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[ExerciseCategories] Erro ao listar categorias:', err);
    res.status(500).json({ error: 'Erro ao listar categorias de exercício.' });
  }
});

orgRouter.post('/exercise-categories', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Informe o nome da categoria.' });
    }

    const cleanName = name.trim();
    const dup = await pool.query(
      `SELECT id FROM exercise_categories WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
      [orgId, cleanName]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: 'Já existe uma categoria com este nome.' });
    }

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO exercise_categories (id, organization_id, name)
       VALUES ($1, $2, $3)
       RETURNING *, 0 AS exercises_count`,
      [id, orgId, cleanName]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[ExerciseCategories] Erro ao criar categoria:', err);
    res.status(500).json({ error: 'Erro ao cadastrar categoria de exercício.' });
  }
});

orgRouter.put('/exercise-categories/:id', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Informe o nome da categoria.' });
    }

    const cleanName = name.trim();
    const dup = await pool.query(
      `SELECT id FROM exercise_categories WHERE organization_id = $1 AND LOWER(name) = LOWER($2) AND id != $3`,
      [orgId, cleanName, id]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: 'Já existe outra categoria com este nome.' });
    }

    const result = await pool.query(
      `UPDATE exercise_categories SET name = $1
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [cleanName, id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ExerciseCategories] Erro ao editar categoria:', err);
    res.status(500).json({ error: 'Erro ao editar categoria de exercício.' });
  }
});

orgRouter.delete('/exercise-categories/:id', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { id } = req.params;

    const childCheck = await pool.query(
      `SELECT COUNT(*)::int AS total FROM exercises WHERE category_id = $1 AND organization_id = $2`,
      [id, orgId]
    );
    if (childCheck.rows[0].total > 0) {
      return res.status(400).json({
        error: `Não é possível excluir esta categoria pois existem ${childCheck.rows[0].total} exercício(s) vinculado(s) a ela.`,
      });
    }

    const del = await pool.query(
      `DELETE FROM exercise_categories WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    );
    if (del.rows.length === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada.' });
    }

    res.json({ message: 'Categoria excluída com sucesso.' });
  } catch (err) {
    console.error('[ExerciseCategories] Erro ao excluir categoria:', err);
    res.status(500).json({ error: 'Erro ao excluir categoria de exercício.' });
  }
});

// 2.3 Cadastro de Exercícios
orgRouter.get('/exercises', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const result = await pool.query(
      `SELECT e.*,
              mg.name AS muscle_group_name,
              ec.name AS category_name
       FROM exercises e
       JOIN muscle_groups mg ON e.muscle_group_id = mg.id
       JOIN exercise_categories ec ON e.category_id = ec.id
       WHERE e.organization_id = $1
       ORDER BY e.is_favorite DESC, e.name ASC`,
      [orgId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Exercises] Erro ao listar exercícios:', err);
    res.status(500).json({ error: 'Erro ao listar exercícios.' });
  }
});

orgRouter.post('/exercises', async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const orgId = req.activeOrgId!;
    const {
      name,
      media_type,
      media_url,
      muscle_group_id,
      new_muscle_group_name,
      category_id,
      new_category_name,
      is_favorite,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O Nome do exercício é obrigatório.' });
    }

    await client.query('BEGIN');

    // Resolver grupo muscular (existente ou novo digitado)
    let resolvedMuscleGroupId = muscle_group_id || '';
    if (new_muscle_group_name && new_muscle_group_name.trim()) {
      const cleanMg = new_muscle_group_name.trim();
      const existingMg = await client.query(
        `SELECT id FROM muscle_groups WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
        [orgId, cleanMg]
      );
      if (existingMg.rows.length > 0) {
        resolvedMuscleGroupId = existingMg.rows[0].id;
      } else {
        resolvedMuscleGroupId = crypto.randomUUID();
        await client.query(
          `INSERT INTO muscle_groups (id, organization_id, name) VALUES ($1, $2, $3)`,
          [resolvedMuscleGroupId, orgId, cleanMg]
        );
      }
    }

    if (!resolvedMuscleGroupId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'O Grupo Muscular é obrigatório.' });
    }

    // Resolver categoria (existente ou nova digitada)
    let resolvedCategoryId = category_id || '';
    if (new_category_name && new_category_name.trim()) {
      const cleanCat = new_category_name.trim();
      const existingCat = await client.query(
        `SELECT id FROM exercise_categories WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
        [orgId, cleanCat]
      );
      if (existingCat.rows.length > 0) {
        resolvedCategoryId = existingCat.rows[0].id;
      } else {
        resolvedCategoryId = crypto.randomUUID();
        await client.query(
          `INSERT INTO exercise_categories (id, organization_id, name) VALUES ($1, $2, $3)`,
          [resolvedCategoryId, orgId, cleanCat]
        );
      }
    }

    if (!resolvedCategoryId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A Categoria do exercício é obrigatória.' });
    }

    const validMediaTypes = ['none', 'photo_gif', 'video', 'youtube'];
    const cleanMediaType = validMediaTypes.includes(media_type) ? media_type : 'none';
    let savedMediaUrl: string | null = null;

    if (cleanMediaType !== 'none' && media_url && String(media_url).trim()) {
      if (cleanMediaType === 'photo_gif' || cleanMediaType === 'video') {
        savedMediaUrl = saveBase64MediaToFile(String(media_url), orgId);
      } else {
        savedMediaUrl = String(media_url).trim();
      }
    }

    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO exercises (
        id, organization_id, name, media_type, media_url, muscle_group_id, category_id, is_favorite
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        orgId,
        name.trim(),
        cleanMediaType,
        savedMediaUrl,
        resolvedMuscleGroupId,
        resolvedCategoryId,
        Boolean(is_favorite),
      ]
    );

    const fullRes = await client.query(
      `SELECT e.*, mg.name AS muscle_group_name, ec.name AS category_name
       FROM exercises e
       JOIN muscle_groups mg ON e.muscle_group_id = mg.id
       JOIN exercise_categories ec ON e.category_id = ec.id
       WHERE e.id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.status(201).json(fullRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Exercises] Erro ao criar exercício:', err);
    res.status(500).json({ error: 'Erro ao cadastrar exercício.' });
  } finally {
    client.release();
  }
});

orgRouter.put('/exercises/:id', async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const orgId = req.activeOrgId!;
    const { id } = req.params;
    const {
      name,
      media_type,
      media_url,
      muscle_group_id,
      new_muscle_group_name,
      category_id,
      new_category_name,
      is_favorite,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O Nome do exercício é obrigatório.' });
    }

    const existingRes = await client.query(
      `SELECT * FROM exercises WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Exercício não encontrado.' });
    }
    const existing = existingRes.rows[0];

    await client.query('BEGIN');

    let resolvedMuscleGroupId = muscle_group_id || '';
    if (new_muscle_group_name && new_muscle_group_name.trim()) {
      const cleanMg = new_muscle_group_name.trim();
      const existingMg = await client.query(
        `SELECT id FROM muscle_groups WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
        [orgId, cleanMg]
      );
      if (existingMg.rows.length > 0) {
        resolvedMuscleGroupId = existingMg.rows[0].id;
      } else {
        resolvedMuscleGroupId = crypto.randomUUID();
        await client.query(
          `INSERT INTO muscle_groups (id, organization_id, name) VALUES ($1, $2, $3)`,
          [resolvedMuscleGroupId, orgId, cleanMg]
        );
      }
    }

    if (!resolvedMuscleGroupId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'O Grupo Muscular é obrigatório.' });
    }

    let resolvedCategoryId = category_id || '';
    if (new_category_name && new_category_name.trim()) {
      const cleanCat = new_category_name.trim();
      const existingCat = await client.query(
        `SELECT id FROM exercise_categories WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
        [orgId, cleanCat]
      );
      if (existingCat.rows.length > 0) {
        resolvedCategoryId = existingCat.rows[0].id;
      } else {
        resolvedCategoryId = crypto.randomUUID();
        await client.query(
          `INSERT INTO exercise_categories (id, organization_id, name) VALUES ($1, $2, $3)`,
          [resolvedCategoryId, orgId, cleanCat]
        );
      }
    }

    if (!resolvedCategoryId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A Categoria do exercício é obrigatória.' });
    }

    const validMediaTypes = ['none', 'photo_gif', 'video', 'youtube'];
    const cleanMediaType = validMediaTypes.includes(media_type) ? media_type : 'none';
    let savedMediaUrl: string | null = null;

    if (cleanMediaType !== 'none' && media_url && String(media_url).trim()) {
      if (cleanMediaType === 'photo_gif' || cleanMediaType === 'video') {
        if (String(media_url).startsWith('data:')) {
          removeUploadedFileIfLocal(existing.media_url);
          savedMediaUrl = saveBase64MediaToFile(String(media_url), orgId);
        } else {
          savedMediaUrl = String(media_url);
        }
      } else {
        if (existing.media_url && existing.media_url.startsWith('/uploads/')) {
          removeUploadedFileIfLocal(existing.media_url);
        }
        savedMediaUrl = String(media_url).trim();
      }
    } else {
      removeUploadedFileIfLocal(existing.media_url);
      savedMediaUrl = null;
    }

    await client.query(
      `UPDATE exercises SET
        name = $1,
        media_type = $2,
        media_url = $3,
        muscle_group_id = $4,
        category_id = $5,
        is_favorite = $6,
        updated_at = NOW()
       WHERE id = $7 AND organization_id = $8`,
      [
        name.trim(),
        cleanMediaType,
        savedMediaUrl,
        resolvedMuscleGroupId,
        resolvedCategoryId,
        Boolean(is_favorite),
        id,
        orgId,
      ]
    );

    const fullRes = await client.query(
      `SELECT e.*, mg.name AS muscle_group_name, ec.name AS category_name
       FROM exercises e
       JOIN muscle_groups mg ON e.muscle_group_id = mg.id
       JOIN exercise_categories ec ON e.category_id = ec.id
       WHERE e.id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.json(fullRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Exercises] Erro ao atualizar exercício:', err);
    res.status(500).json({ error: 'Erro ao atualizar exercício.' });
  } finally {
    client.release();
  }
});

// Alternar favorito rapidamente
orgRouter.patch('/exercises/:id/favorite', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { id } = req.params;
    const { is_favorite } = req.body;

    const result = await pool.query(
      `UPDATE exercises SET is_favorite = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [Boolean(is_favorite), id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exercício não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Exercises] Erro ao favoritar exercício:', err);
    res.status(500).json({ error: 'Erro ao favoritar exercício.' });
  }
});

orgRouter.delete('/exercises/:id', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { id } = req.params;

    const existing = await pool.query(
      `SELECT media_url FROM exercises WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );
    if (existing.rows.length > 0) {
      removeUploadedFileIfLocal(existing.rows[0].media_url);
    }

    await pool.query(`DELETE FROM exercises WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    res.json({ message: 'Exercício excluído com sucesso.' });
  } catch (err) {
    console.error('[Exercises] Erro ao excluir exercício:', err);
    res.status(500).json({ error: 'Erro ao excluir exercício.' });
  }
});

// ============================================================================
// 2.4 ESQUEMAS DE EXECUÇÃO (Pré-definidos e Salvos pelo Usuário)
// ============================================================================
const VALID_SCHEME_TYPES = ['series_retas', 'piramide', 'drop_set', 'rest_pause', 'ate_a_falha'];
const VALID_REP_UNITS = ['reps', 'seconds', 'minutes'];
const VALID_REST_UNITS = ['seconds', 'minutes'];

orgRouter.get('/exercise-schemes', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const result = await pool.query(
      `SELECT * FROM exercise_schemes
       WHERE organization_id = $1
       ORDER BY is_default DESC, created_at ASC`,
      [orgId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[ExerciseSchemes] Erro ao listar esquemas:', err);
    res.status(500).json({ error: 'Erro ao listar esquemas de execução.' });
  }
});

orgRouter.post('/exercise-schemes', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { name, scheme_type, sets, reps, rep_unit, rest_time, rest_unit } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Informe um nome para identificar o esquema.' });
    }

    const cleanName = String(name).trim();
    const cleanType = VALID_SCHEME_TYPES.includes(scheme_type) ? scheme_type : 'series_retas';
    const cleanSets = Math.max(1, parseInt(String(sets || 3), 10) || 3);
    const cleanReps = String(reps || '10').trim() || '10';
    const cleanUnit = VALID_REP_UNITS.includes(rep_unit) ? rep_unit : 'reps';
    const cleanRestTime = rest_time !== undefined && rest_time !== null ? String(rest_time).trim() : '';
    const cleanRestUnit = VALID_REST_UNITS.includes(rest_unit) ? rest_unit : 'seconds';

    const existing = await pool.query(
      `SELECT id FROM exercise_schemes WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
      [orgId, cleanName]
    );

    if (existing.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE exercise_schemes
         SET name = $1, scheme_type = $2, sets = $3, reps = $4, rep_unit = $5, rest_time = $6, rest_unit = $7
         WHERE id = $8 AND organization_id = $9
         RETURNING *`,
        [cleanName, cleanType, cleanSets, cleanReps, cleanUnit, cleanRestTime || null, cleanRestUnit, existing.rows[0].id, orgId]
      );
      return res.json(updated.rows[0]);
    }

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO exercise_schemes (id, organization_id, name, scheme_type, sets, reps, rep_unit, rest_time, rest_unit, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE)
       RETURNING *`,
      [id, orgId, cleanName, cleanType, cleanSets, cleanReps, cleanUnit, cleanRestTime || null, cleanRestUnit]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[ExerciseSchemes] Erro ao salvar esquema:', err);
    res.status(500).json({ error: 'Erro ao salvar esquema de execução.' });
  }
});

orgRouter.delete('/exercise-schemes/:id', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { id } = req.params;
    await pool.query(`DELETE FROM exercise_schemes WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    res.json({ message: 'Esquema removido com sucesso.' });
  } catch (err) {
    console.error('[ExerciseSchemes] Erro ao remover esquema:', err);
    res.status(500).json({ error: 'Erro ao remover esquema.' });
  }
});

// ============================================================================
// 2.5 TEMPLATES DE TREINO
// ============================================================================
async function fetchWorkoutTemplatesWithItems(orgId: string, templateId?: string) {
  const params: any[] = [orgId];
  let whereClause = `wt.organization_id = $1`;
  if (templateId) {
    params.push(templateId);
    whereClause += ` AND wt.id = $2`;
  }

  const templatesRes = await pool.query(
    `SELECT wt.*
     FROM workout_templates wt
     WHERE ${whereClause}
     ORDER BY wt.updated_at DESC, wt.name ASC`,
    params
  );

  if (templatesRes.rows.length === 0) return [];

  const templateIds = templatesRes.rows.map((r) => r.id);
  const itemsRes = await pool.query(
    `SELECT wti.*,
            e.name AS exercise_name,
            e.media_type,
            e.media_url,
            e.muscle_group_id,
            mg.name AS muscle_group_name,
            e.category_id,
            ec.name AS category_name,
            e.is_favorite
     FROM workout_template_items wti
     JOIN exercises e ON wti.exercise_id = e.id
     JOIN muscle_groups mg ON e.muscle_group_id = mg.id
     JOIN exercise_categories ec ON e.category_id = ec.id
     WHERE wti.template_id = ANY($1::varchar[])
     ORDER BY wti.position ASC, wti.created_at ASC`,
    [templateIds]
  );

  const itemsByTemplate = new Map<string, any[]>();
  for (const row of itemsRes.rows) {
    const list = itemsByTemplate.get(row.template_id) || [];
    list.push(row);
    itemsByTemplate.set(row.template_id, list);
  }

  return templatesRes.rows.map((tpl) => ({
    ...tpl,
    items: itemsByTemplate.get(tpl.id) || [],
  }));
}

orgRouter.get('/workout-templates', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const templates = await fetchWorkoutTemplatesWithItems(orgId);
    res.json(templates);
  } catch (err) {
    console.error('[WorkoutTemplates] Erro ao listar templates:', err);
    res.status(500).json({ error: 'Erro ao listar templates de treino.' });
  }
});

orgRouter.post('/workout-templates', async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const orgId = req.activeOrgId!;
    const { name, student_group_id, student_group_name, items } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'O Nome do template de treino é obrigatório.' });
    }

    await client.query('BEGIN');

    // Resolver Grupo de Alunos (padrão 'Todos' quando vazio ou 'all' / 'Todos')
    let resolvedGroupId: string | null = null;
    let resolvedGroupName = 'Todos';

    if (student_group_id && student_group_id !== 'all' && student_group_id !== 'Todos') {
      const gRes = await client.query(
        `SELECT id, name FROM student_groups WHERE id = $1 AND organization_id = $2`,
        [student_group_id, orgId]
      );
      if (gRes.rows.length > 0) {
        resolvedGroupId = gRes.rows[0].id;
        resolvedGroupName = gRes.rows[0].name;
      }
    } else if (
      student_group_name &&
      String(student_group_name).trim() &&
      String(student_group_name).trim().toLowerCase() !== 'todos'
    ) {
      const cleanGName = String(student_group_name).trim();
      const gRes = await client.query(
        `SELECT id, name FROM student_groups WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
        [orgId, cleanGName]
      );
      if (gRes.rows.length > 0) {
        resolvedGroupId = gRes.rows[0].id;
        resolvedGroupName = gRes.rows[0].name;
      } else {
        resolvedGroupName = cleanGName;
      }
    }

    const templateId = crypto.randomUUID();
    await client.query(
      `INSERT INTO workout_templates (id, organization_id, name, student_group_id, student_group_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [templateId, orgId, String(name).trim(), resolvedGroupId, resolvedGroupName]
    );

    if (Array.isArray(items) && items.length > 0) {
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        if (!it.exercise_id) continue;
        const cleanType = VALID_SCHEME_TYPES.includes(it.scheme_type) ? it.scheme_type : 'series_retas';
        const cleanSets = Math.max(1, parseInt(String(it.sets || 3), 10) || 3);
        const cleanReps = String(it.reps || '10').trim() || '10';
        const cleanUnit = VALID_REP_UNITS.includes(it.rep_unit) ? it.rep_unit : 'reps';
        const cleanRestTime = it.rest_time !== undefined && it.rest_time !== null ? String(it.rest_time).trim() : '';
        const cleanRestUnit = VALID_REST_UNITS.includes(it.rest_unit) ? it.rest_unit : 'seconds';
        const cleanSchemeName = String(it.scheme_name || `${cleanSets}x${cleanReps}`).trim();

        await client.query(
          `INSERT INTO workout_template_items (
            id, template_id, organization_id, position, exercise_id,
            scheme_id, scheme_name, scheme_type, sets, reps, rep_unit, rest_time, rest_unit, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            crypto.randomUUID(),
            templateId,
            orgId,
            idx,
            it.exercise_id,
            it.scheme_id || null,
            cleanSchemeName,
            cleanType,
            cleanSets,
            cleanReps,
            cleanUnit,
            cleanRestTime || null,
            cleanRestUnit,
            it.notes || null,
          ]
        );
      }
    }

    await client.query('COMMIT');
    const created = await fetchWorkoutTemplatesWithItems(orgId, templateId);
    res.status(201).json(created[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[WorkoutTemplates] Erro ao criar template:', err);
    res.status(500).json({ error: 'Erro ao criar template de treino.' });
  } finally {
    client.release();
  }
});

orgRouter.put('/workout-templates/:id', async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const orgId = req.activeOrgId!;
    const { id } = req.params;
    const { name, student_group_id, student_group_name, items } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'O Nome do template de treino é obrigatório.' });
    }

    const check = await client.query(
      `SELECT id FROM workout_templates WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Template de treino não encontrado.' });
    }

    await client.query('BEGIN');

    let resolvedGroupId: string | null = null;
    let resolvedGroupName = 'Todos';

    if (student_group_id && student_group_id !== 'all' && student_group_id !== 'Todos') {
      const gRes = await client.query(
        `SELECT id, name FROM student_groups WHERE id = $1 AND organization_id = $2`,
        [student_group_id, orgId]
      );
      if (gRes.rows.length > 0) {
        resolvedGroupId = gRes.rows[0].id;
        resolvedGroupName = gRes.rows[0].name;
      }
    } else if (
      student_group_name &&
      String(student_group_name).trim() &&
      String(student_group_name).trim().toLowerCase() !== 'todos'
    ) {
      const cleanGName = String(student_group_name).trim();
      const gRes = await client.query(
        `SELECT id, name FROM student_groups WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
        [orgId, cleanGName]
      );
      if (gRes.rows.length > 0) {
        resolvedGroupId = gRes.rows[0].id;
        resolvedGroupName = gRes.rows[0].name;
      } else {
        resolvedGroupName = cleanGName;
      }
    }

    await client.query(
      `UPDATE workout_templates
       SET name = $1, student_group_id = $2, student_group_name = $3, updated_at = NOW()
       WHERE id = $4 AND organization_id = $5`,
      [String(name).trim(), resolvedGroupId, resolvedGroupName, id, orgId]
    );

    await client.query(
      `DELETE FROM workout_template_items WHERE template_id = $1 AND organization_id = $2`,
      [id, orgId]
    );

    if (Array.isArray(items) && items.length > 0) {
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        if (!it.exercise_id) continue;
        const cleanType = VALID_SCHEME_TYPES.includes(it.scheme_type) ? it.scheme_type : 'series_retas';
        const cleanSets = Math.max(1, parseInt(String(it.sets || 3), 10) || 3);
        const cleanReps = String(it.reps || '10').trim() || '10';
        const cleanUnit = VALID_REP_UNITS.includes(it.rep_unit) ? it.rep_unit : 'reps';
        const cleanRestTime = it.rest_time !== undefined && it.rest_time !== null ? String(it.rest_time).trim() : '';
        const cleanRestUnit = VALID_REST_UNITS.includes(it.rest_unit) ? it.rest_unit : 'seconds';
        const cleanSchemeName = String(it.scheme_name || `${cleanSets}x${cleanReps}`).trim();

        await client.query(
          `INSERT INTO workout_template_items (
            id, template_id, organization_id, position, exercise_id,
            scheme_id, scheme_name, scheme_type, sets, reps, rep_unit, rest_time, rest_unit, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            crypto.randomUUID(),
            id,
            orgId,
            idx,
            it.exercise_id,
            it.scheme_id || null,
            cleanSchemeName,
            cleanType,
            cleanSets,
            cleanReps,
            cleanUnit,
            cleanRestTime || null,
            cleanRestUnit,
            it.notes || null,
          ]
        );
      }
    }

    await client.query('COMMIT');
    const updated = await fetchWorkoutTemplatesWithItems(orgId, String(id));
    res.json(updated[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[WorkoutTemplates] Erro ao atualizar template:', err);
    res.status(500).json({ error: 'Erro ao atualizar template de treino.' });
  } finally {
    client.release();
  }
});

orgRouter.delete('/workout-templates/:id', async (req: AuthRequest, res) => {
  try {
    const orgId = req.activeOrgId!;
    const { id } = req.params;
    await pool.query(`DELETE FROM workout_templates WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    res.json({ message: 'Template de treino excluído com sucesso.' });
  } catch (err) {
    console.error('[WorkoutTemplates] Erro ao excluir template:', err);
    res.status(500).json({ error: 'Erro ao excluir template de treino.' });
  }
});
