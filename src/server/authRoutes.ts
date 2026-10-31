import { Router } from 'express';
import crypto from 'crypto';
import { pool } from './db';
import {
  AuthRequest,
  authenticateToken,
  generateToken,
  hashPassword,
  verifyPassword,
} from './auth';

export const authRouter = Router();

// Login
authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Informe o usuário e a senha.' });
    }

    const userRes = await pool.query(
      `SELECT u.*, o.name as org_name, o.logo as org_logo, o.phone as org_phone, o.document as org_document,
              o.max_admins, o.max_users, o.max_students, o.mod_students, o.mod_exercises
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE LOWER(u.username) = LOWER($1)`,
      [username.trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    const user = userRes.rows[0];
    if (!user.active) {
      return res.status(403).json({ error: 'Este usuário está desativado.' });
    }

    if (!verifyPassword(password, user.salt, user.password_hash)) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    const token = await generateToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      organization_id: user.organization_id,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        must_change_password: Boolean(user.must_change_password),
        organization: user.organization_id
          ? {
              id: user.organization_id,
              name: user.org_name,
              logo: user.org_logo,
              phone: user.org_phone,
              document: user.org_document,
              max_admins: user.max_admins,
              max_users: user.max_users,
              max_students: user.max_students,
              mod_students: user.mod_students,
              mod_exercises: user.mod_exercises,
            }
          : null,
      },
    });
  } catch (err) {
    console.error('[Auth] Erro no login:', err);
    res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
});

// Me (retorna usuário autenticado + contexto da organização ativa)
authRouter.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userRes = await pool.query(
      `SELECT id, username, name, email, role, organization_id, must_change_password FROM users WHERE id = $1`,
      [req.user!.id]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const user = userRes.rows[0];

    let activeOrg = null;
    if (req.activeOrgId) {
      const orgRes = await pool.query(`SELECT * FROM organizations WHERE id = $1`, [req.activeOrgId]);
      if (orgRes.rows.length > 0) {
        activeOrg = orgRes.rows[0];
      }
    }

    res.json({
      user: {
        ...user,
        must_change_password: Boolean(user.must_change_password),
        organization: activeOrg,
      },
    });
  } catch (err) {
    console.error('[Auth] Erro ao buscar perfil:', err);
    res.status(500).json({ error: 'Erro ao carregar dados da sessão.' });
  }
});

// Troca obrigatória de senha no primeiro acesso
authRouter.post('/first-access-password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    const userId = req.user!.id;

    if (!newPassword || String(newPassword).trim().length < 4) {
      return res.status(400).json({ error: 'Informe uma nova senha com pelo menos 4 caracteres.' });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'A confirmação de senha não confere.' });
    }

    const userRes = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const user = userRes.rows[0];

    if (verifyPassword(newPassword, user.salt, user.password_hash)) {
      return res.status(400).json({ error: 'A nova senha deve ser diferente da senha provisória atual.' });
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashPassword(newPassword, newSalt);

    await pool.query(
      `UPDATE users SET password_hash = $1, salt = $2, must_change_password = FALSE, updated_at = NOW() WHERE id = $3`,
      [newHash, newSalt, userId]
    );

    res.json({ message: 'Senha alterada com sucesso.' });
  } catch (err) {
    console.error('[Auth] Erro ao alterar senha no primeiro acesso:', err);
    res.status(500).json({ error: 'Erro ao alterar senha.' });
  }
});

// Atualizar própria senha / perfil
authRouter.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    const userRes = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const user = userRes.rows[0];

    if (newPassword) {
      if (!currentPassword || !verifyPassword(currentPassword, user.salt, user.password_hash)) {
        return res.status(400).json({ error: 'A senha atual informada está incorreta.' });
      }
      const newSalt = crypto.randomBytes(16).toString('hex');
      const newHash = hashPassword(newPassword, newSalt);
      await pool.query(
        `UPDATE users SET name = $1, email = $2, password_hash = $3, salt = $4, must_change_password = FALSE, updated_at = NOW() WHERE id = $5`,
        [name || user.name, email ?? user.email, newHash, newSalt, userId]
      );
    } else {
      await pool.query(
        `UPDATE users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3`,
        [name || user.name, email ?? user.email, userId]
      );
    }

    res.json({ message: 'Perfil atualizado com sucesso.' });
  } catch (err) {
    console.error('[Auth] Erro ao atualizar perfil:', err);
    res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
});
