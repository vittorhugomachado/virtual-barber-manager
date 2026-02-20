# Virtual Barber - Frontend

Interface web do sistema de agendamentos para barbearias **Virtual Barber**, construída com React + TypeScript e integrada ao Supabase.

---

## Tecnologias

- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Supabase](https://supabase.com/) — banco de dados, autenticação e storage

---

## Funcionalidades

- Cadastro e login de donos de barbearia (email + senha)
- Cadastro e login de barbeiros (email + senha)
- Login de clientes via SMS (OTP)
- Gerenciamento de barbearia (nome, endereço, logo, banner)
- Cadastro de serviços e barbeiros
- Agendamento com controle de conflitos de horário
- Horários de funcionamento por dia da semana

---

## Pré-requisitos

Este projeto **não possui um backend próprio**. Todo o banco de dados, autenticação e storage são gerenciados pelo **Supabase**. Por isso, para rodar o projeto localmente ou em produção, você precisará criar sua própria conta e projeto no Supabase e configurar o banco de dados.

### 1. Crie seu projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. No **SQL Editor**, execute os scripts de criação de tabelas disponíveis na pasta `/database` deste repositório, na seguinte ordem:
   - `01_enums.sql`
   - `02_tables.sql`
   - `03_triggers.sql`
   - `04_rls.sql`
4. No painel do Supabase, vá em **Database → Triggers** e crie manualmente o trigger `trg_create_profile` apontando para a função `handle_new_user` na tabela `auth.users` (evento `INSERT`, orientação `ROW`, timing `AFTER`)
5. Suas credenciais estão em **Settings → API**

---

## Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/virtual-barber-frontend.git
cd virtual-barber-frontend
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

> As credenciais acima são pessoais e vinculadas ao seu projeto no Supabase. Nunca compartilhe sua `service_role key`.

### 4. Rode o projeto

```bash
npm run dev
```

---

## Banco de Dados

O banco de dados está no Supabase com as seguintes tabelas:

- `profiles` — todos os usuários (owner, barber, customer)
- `barbershops` — dados da barbearia
- `addresses` — endereço da barbearia
- `barbers` — perfil profissional dos barbeiros
- `services` — serviços oferecidos
- `service_barbers` — relação barbeiro x serviço
- `opening_hours` — horários de funcionamento
- `customers` — clientes por barbearia
- `appointments` — agendamentos com controle de conflito

---

## Autenticação

```ts
// Cadastro de owner
await supabase.auth.signUp({
  email, password,
  options: { data: { role: 'barbershop' } }
})

// Login
await supabase.auth.signInWithPassword({ email, password })

// Logout
await supabase.auth.signOut()
```
