# ViraFit

Sistema multiorganização para Personal Trainers e Estúdios de Treinamento.

## Recursos
- **Usuário Master**: Gerencia organizações (Nome, CPF/CNPJ, Telefone, Observação, Logo, Limites de Usuários, Administradores e Alunos, Liberação de Módulos), usuários vinculados, métricas globais com filtro por organização e acesso rápido a qualquer organização.
- **Perfis por Organização**: Administradores (podem criar/editar/excluir usuários administradores e padrão da sua organização) e Usuários Padrão. Isolamento total entre organizações.
- **Módulo 1 — Gestão de Alunos**: Cadastro completo de alunos com Nome*, CPF/CNPJ*, Telefone*, Gênero*, Grupo* (Presencial, Online + criação de novos grupos via modal), Observação, E-mail e Endereço completo (consulta automática por CEP + instruções de entrega).
- **Módulo 2 — Exercícios**:
  - **Grupos Musculares**: Cadastro simples com grupos pré-cadastrados automaticamente ao criar cada organização e bloqueio de exclusão caso possua exercícios associados.
  - **Categorias de Exercício**: Cadastro simples com categorias pré-cadastradas automaticamente ao criar cada organização e bloqueio de exclusão caso possua exercícios associados.
  - **Cadastro de Exercícios**: Nome*, Mídia (Foto/GIF com upload, Vídeo com upload, ou Vídeo do YouTube por link), Grupo Muscular* (listbox com busca e criação inline), Categoria* (listbox com busca e criação inline) e Favorito (estrela).
- **Visual**: Interface fluida e minimalista com alternância entre modo claro e escuro.

## Executar Localmente
```bash
cp .env.example .env   # ajuste o acesso ao PostgreSQL
npm install
npm run dev            # http://localhost:5176 (API em 3336)
```
Usuário Master inicial: `master` / `admin123`.

## Produção
`npm run build && npm start`. Deploy em `virafit.viratempo.dev` via PM2 (porta 3336) e Nginx (`deploy/nginx-virafit.conf`).
