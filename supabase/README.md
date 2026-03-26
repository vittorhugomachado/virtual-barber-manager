# 📚 Documentação do Backend — Virtual Barber (Supabase)

> Este documento explica como o backend do projeto **Virtual Barber** funciona no Supabase.  
> É voltado para novos membros do time que ainda não conhecem Supabase ou que precisam entender a estrutura do projeto antes de começar a desenvolver.

---

## 📌 O que é o Supabase?

O Supabase é uma plataforma de backend open-source que funciona como alternativa ao Firebase. Ele oferece um banco de dados **PostgreSQL** gerenciado, autenticação de usuários, storage de arquivos, funções serverless (Edge Functions) e realtime — tudo com uma API REST e SDK prontos para uso.

No Virtual Barber, o Supabase é o **único backend** da aplicação. O frontend React se comunica diretamente com ele via `@supabase/supabase-js`.

---

## 🗂️ Sumário

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Authentication](#authentication)
3. [Tipos Enumerados (Enums)](#tipos-enumerados-enums)
4. [Tabelas (Tables)](#tabelas-tables)
5. [Funções SQL (Functions)](#funções-sql-functions)
6. [Triggers](#triggers)
7. [Policies (RLS)](#policies-rls)
8. [Edge Functions](#edge-functions)
9. [Storage](#storage)
10. [Extensions](#extensions)
11. [Realtime (Publication)](#realtime-publication)
12. [Roles do PostgreSQL](#roles-do-postgresql)
13. [Fluxos Importantes](#fluxos-importantes)

---

## 🏗️ Visão Geral da Arquitetura

```
Frontend (React + TypeScript)
        │
        ▼
Supabase JS SDK (@supabase/supabase-js)
        │
        ├── Auth       → Autenticação de usuários
        ├── Database   → Queries PostgreSQL via REST (PostgREST)
        ├── Storage    → Upload de imagens
        ├── Functions  → Edge Functions (operações privilegiadas)
        └── Realtime   → Atualizações em tempo real (não usado ativamente ainda)
```

O banco de dados tem RLS (Row Level Security) habilitado em **todas as tabelas**, o que significa que as regras de acesso ficam no banco — não no frontend. Isso garante segurança mesmo que o frontend seja comprometido.

---

## 🔐 Authentication

O Supabase gerencia autenticação na tabela interna `auth.users` (schema `auth`, não editável diretamente).

### Tipos de autenticação usados no projeto

| Tipo | Usado por quem |
|---|---|
| **Email + Senha** | Donos de barbearia e membros da equipe |
| **OAuth Google** | Clientes que agendam via app público |

### Como funciona o fluxo de cadastro

1. Usuário se cadastra (barbearia com email e senha, cliente com OAuth)
2. Supabase cria o registro em `auth.users`
3. O trigger `trg_create_profile` dispara automaticamente — pertence ao
   schema `auth` e não aparece no Dashboard em Database → Triggers
4. A função `handle_new_user()` detecta o provider e cria o registro em
   `public.profiles` com o role correto:
   - Provider `email` → `role = 'barbershop'`
   - Provider OAuth (Google, etc.) → `role = 'customer'`

### Tabela `auth.users` vs `public.profiles`

`auth.users` é gerenciada pelo Supabase e contém dados sensíveis (email, senha hash, tokens). Você **nunca deve** fazer queries diretas nela com o cliente público.

`public.profiles` é a sua tabela, espelho de `auth.users`, com apenas os dados que você precisa expor (`role`, `name`). Use ela nas queries do frontend.

```typescript
// Correto: lê dados do usuário autenticado
const { data: { user } } = await supabase.auth.getUser()

// Correto: lê o perfil da tabela pública
const { data: profile } = await supabase
  .from('profiles')
  .select('role, name')
  .eq('id', user.id)
  .single()
```


### Email sintético de membros

Membros da barbearia não têm email real. A Edge Function `create-member`
cria um email interno no formato:
```
{username}@{barbershop_id}.member
```

Exemplo: `vitor@1fdd7b3a-066e-4394-a267-7b5c7fce794f.member`

Isso permite que eles façam login sem expor emails reais. No login do membro função `get_member_auth_email()` é chamada no frontend via `supabase.rpc()`
recebendo o `username` e o `slug` da barbearia como parâmetros, e retorna
a string do email sintético com o `barbershop_id`. Esse email é então usado
no `signInWithPassword` do Supabase Auth, que faz a validação real
das credenciais.

---

## 🏷️ Tipos Enumerados (Enums)

Enums são tipos de dados com valores fixos. Eles garantem que colunas só aceitem valores válidos, evitando erros de digitação.

### Enums do projeto (`public` schema)

#### `user_role`
Define o papel de um usuário na plataforma.

| Valor | Descrição |
|---|---|
| `barbershop` | Dono de barbearia |
| `barber` | Barbeiro (não usado ativamente, reservado) |
| `customer` | Cliente que agenda via app |
| `member` | Membro da equipe de uma barbearia |
| `barbershop_member` | Alias legado, não usar em código novo |

#### `member_role`
Define o nível de acesso de um membro dentro de uma barbearia.

| Valor | Descrição |
|---|---|
| `admin` | Pode gerenciar galeria, serviços, barbeiros e agenda |
| `reader` | Só visualiza informações, sem permissão de escrita |

#### `appointment_status`
Define o status de um agendamento.

| Valor | Descrição |
|---|---|
| `scheduled` | Agendado (status padrão ao criar) |
| `completed` | Atendimento concluído |
| `cancelled_by_customer` | Cancelado pelo cliente |
| `cancelled_by_barbershop` | Cancelado pela barbearia |
| `no_show` | Cliente não compareceu (setado automaticamente após 40 min) |

#### `brazilian_state`
Todos os 27 estados brasileiros (AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO). Usado na tabela `addresses`.

---

## 📊 Tabelas (Tables)

Todas as tabelas ficam no schema `public` e têm **RLS habilitado**. Abaixo está a descrição de cada uma:

---

### `profiles`
Espelho de `auth.users`. Criado automaticamente via trigger no cadastro.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Mesmo ID do `auth.users` |
| `role` | user_role | Papel do usuário na plataforma |
| `name` | text | Nome do usuário |
| `created_at` | timestamptz | Data de criação |
| `updated_at` | timestamptz | Última atualização |

---

### `barbershops`
Registro de cada barbearia cadastrada na plataforma.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | ID único |
| `owner_id` | uuid | FK para `auth.users` (dono) |
| `name` | text | Nome da barbearia (máx. 30 chars) |
| `slug` | text | URL amigável gerada automaticamente |
| `email` | text | Email de contato |
| `phone` | text | Telefone (único no sistema) |
| `description` | text | Descrição da barbearia |
| `logo_url` | text | URL do logo |
| `banner_url` | text | URL do banner |
| `is_active` | boolean | Se a barbearia está ativa |
| `plan` | text | Plano contratado: `iniciante`, `profissional`, `master` |
| `template` | text | Template visual da página pública |

> **Slug:** Gerado automaticamente pela função `register_barbershop()` a partir do nome. Acentos e caracteres especiais são removidos. Em caso de duplicata, 4 ou 15 chars do UUID são adicionados como sufixo.

> **Planos e limites:**
> - `iniciante`: 1 barbeiro, 5 serviços
> - `profissional`: 5 barbeiros, 20 serviços
> - `master`: ilimitado

---

### `barbers`
Barbeiros vinculados a uma barbearia.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | ID único |
| `barbershop_id` | uuid | FK para `barbershops` |
| `name` | text | Nome do barbeiro |
| `description` | text | Bio/descrição |
| `avatar_url` | text | Foto do barbeiro |
| `is_active` | boolean | Se está ativo (limite do plano é verificado aqui) |

---

### `services`
Serviços oferecidos por uma barbearia.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | ID único |
| `barbershop_id` | uuid | FK para `barbershops` |
| `name` | text | Nome do serviço |
| `description` | varchar | Descrição |
| `image_url` | text | Imagem do serviço |
| `duration_min` | numeric | Duração em minutos |
| `price` | numeric | Preço |
| `is_active` | boolean | Se está ativo |

---

### `barber_services`
Tabela de junção (N:N) entre barbeiros e serviços. Define quais barbeiros realizam quais serviços.

| Coluna | Tipo | Descrição |
|---|---|---|
| `barber_id` | uuid | FK para `barbers` |
| `service_id` | uuid | FK para `services` |

---

### `customers`
Clientes de cada barbearia. Um cliente pode existir em múltiplas barbearias.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | ID único |
| `barbershop_id` | uuid | FK para `barbershops` |
| `auth_user_id` | uuid | FK para `auth.users` (se o cliente tem conta) |
| `name` | text | Nome do cliente |
| `email` | text | Email |
| `phone` | text | Telefone |

> Clientes OAuth (login pelo Google) precisam ter um registro aqui criado **pelo frontend** após o primeiro login, pois o trigger não conhece o contexto da barbearia acessada.

---

### `appointments`
Agendamentos. É a tabela central do sistema.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | ID único |
| `barbershop_id` | uuid | FK para `barbershops` |
| `customer_id` | uuid | FK para `customers` |
| `barber_id` | uuid | FK para `barbers` |
| `service_id` | uuid | FK para `services` |
| `status` | appointment_status | Status atual |
| `starts_at` | timestamptz | Início do agendamento |
| `ends_at` | timestamptz | Fim do agendamento |
| `notes` | text | Observações |

---

### `opening_hours`
Horários de funcionamento de cada barbearia por dia da semana.

| Coluna | Tipo | Descrição |
|---|---|---|
| `barbershop_id` | uuid | FK para `barbershops` |
| `day_of_week` | smallint | 0=Domingo, 1=Segunda, ..., 6=Sábado |
| `opens_at` | time | Horário de abertura |
| `closes_at` | time | Horário de fechamento |
| `is_open` | boolean | Se está aberto nesse dia |
| `period_order` | integer | Ordem do período (para múltiplos turnos) |

> Um agendamento só é aceito se existir um registro `is_open = true` que cubra o horário completo. Isso é verificado pelo trigger `trg_validate_appointment_opening_hours`.

---

### `barber_availability`
Exceções ou personalizações de disponibilidade por barbeiro. Permite que um barbeiro tenha horários diferentes dos da barbearia.

| Coluna | Tipo | Descrição |
|---|---|---|
| `barber_id` | uuid | FK para `barbers` |
| `barbershop_id` | uuid | FK para `barbershops` |
| `day_of_week` | smallint | Dia da semana |
| `is_day_off` | boolean | Se está de folga nesse dia |
| `use_custom_hours` | boolean | Se usa horário customizado |
| `starts_at` | time | Início do horário customizado |
| `ends_at` | time | Fim do horário customizado |

---

### `barbershop_members`
Membros da equipe de uma barbearia. São funcionários com acesso ao painel de gestão.

| Coluna | Tipo | Descrição |
|---|---|---|
| `barbershop_id` | uuid | FK para `barbershops` |
| `user_id` | uuid | FK para `auth.users` |
| `username` | text | Nome de login (único por barbearia) |
| `role` | member_role | `admin` ou `reader` |

---

### `addresses`
Endereço físico de uma barbearia.

| Coluna | Tipo | Descrição |
|---|---|---|
| `barbershop_id` | uuid | FK para `barbershops` |
| `country` | text | País (default: `Brasil`) |
| `state` | brazilian_state | Estado (enum com todos os 27 estados) |
| `city` | text | Cidade |
| `neighborhood` | text | Bairro |
| `street` | text | Rua |
| `number` | text | Número |
| `complement` | text | Complemento (opcional) |
| `zip_code` | char | CEP |
| `latitude` | float | Coordenada geográfica (opcional) |
| `longitude` | float | Coordenada geográfica (opcional) |

---

### `barbershop_gallery`
Fotos da galeria de uma barbearia, exibidas na página pública.

| Coluna | Tipo | Descrição |
|---|---|---|
| `barbershop_id` | uuid | FK para `barbershops` |
| `url` | text | URL da imagem |
| `order` | integer | Ordem de exibição |

---

### `social_media`
Links de redes sociais de uma barbearia.

| Coluna | Tipo | Descrição |
|---|---|---|
| `barbershop_id` | uuid | FK para `barbershops` |
| `instagram` | text | URL do Instagram |
| `facebook` | text | URL do Facebook |
| `tiktok` | text | URL do TikTok |

---

### `store_style`
Personalização visual da página pública de cada barbearia.

| Coluna | Tipo | Descrição |
|---|---|---|
| `barbershop_id` | uuid | FK para `barbershops` |
| `primary_color` | text | Cor primária (hex) |
| `text_color` | text | Cor do texto (hex) |
| `text_button_color` | text | Cor do texto nos botões (hex) |
| `theme_is_dark` | boolean | Tema escuro ou claro |

---

## ⚙️ Funções SQL (Functions)

Funções são blocos de lógica executados diretamente no banco. Usamos duas categorias:

### Funções de negócio (chamadas pelo frontend)

#### `register_barbershop(p_user_id, p_name, p_phone, p_barbershop_name, p_email)`
Cria uma barbearia completa em uma única transação atômica. Faz:
1. Verifica se o telefone já existe → lança `phone_already_exists`
2. Gera o slug a partir do nome (remove acentos, caracteres especiais, converte espaços em hífens)
3. Garante unicidade do slug adicionando sufixo do UUID se necessário
4. Atualiza o `profiles` do usuário com `role = 'barbershop'` e nome
5. Insere a barbearia

#### `get_member_auth_email(p_username, p_slug)`
Retorna o email sintético de um membro a partir do username e slug da barbearia. Usado no login de membros.

#### `get_my_barbershop_id()`
Retorna o ID da barbearia do usuário autenticado (seja como dono ou como membro).

#### `get_my_member_barbershop_id()`
Retorna o `barbershop_id` do membro autenticado.

#### `is_barbershop_member(p_barbershop_id)`
Retorna `true` se o usuário autenticado é membro da barbearia informada.

#### `is_barbershop_admin(p_barbershop_id)`
Retorna `true` se o usuário autenticado é membro com `role = 'admin'`.

#### `user_has_barbershop_access(p_barbershop_id)`
Retorna `true` se o usuário é dono **ou** membro da barbearia.

#### `check_phone_exists(p_phone)`
Retorna `true` se o telefone já está cadastrado em alguma barbearia.

#### `add_member_by_email(p_email, p_role, p_barbershop_id)`
Adiciona um usuário existente como membro de uma barbearia (legado — preferir Edge Function `create-member`).

#### `remove_member(p_member_id)`
Remove um membro. Só o dono da barbearia pode executar.

#### `mark_no_show_appointments()`
Marca como `no_show` todos os agendamentos com status `scheduled` que já passaram há mais de 40 minutos (considerando UTC-3). Executada via cron job.

#### `get_barbershop_members(p_barbershop_id)`
Retorna todos os membros de uma barbearia (id, user_id, role, username).

---

### Funções de trigger (executadas automaticamente)

#### `handle_new_user()`
Disparada quando um novo usuário é criado em `auth.users`. Cria o registro em `public.profiles` com o role correto baseado no provider de autenticação.

#### `check_appointment_conflict()`
Bloqueia agendamentos que conflitem com outro do mesmo barbeiro no mesmo horário. Ignora agendamentos cancelados ou concluídos.

#### `validate_appointment_opening_hours()`
Valida que o horário do agendamento está dentro do horário de funcionamento da barbearia. Agendamentos cancelados são isentos dessa verificação.

#### `check_barber_plan_limit()`
Impede ativar um barbeiro se a barbearia já atingiu o limite de barbeiros ativos do seu plano.

#### `check_service_plan_limit()`
Impede ativar um serviço se a barbearia já atingiu o limite de serviços do seu plano.

#### `enforce_barber_limit_on_plan_change()`
Quando o plano de uma barbearia é rebaixado (downgrade), desativa os barbeiros mais recentes que excedem o novo limite.

#### `enforce_service_limit_on_plan_change()`
Mesmo comportamento do anterior, mas para serviços.

#### `check_opening_hours_overlap()`
Impede cadastrar horários de funcionamento sobrepostos para o mesmo dia.

#### `prevent_customer_delete_with_scheduled()`
Impede deletar um cliente que ainda tem agendamentos com status `scheduled`.

#### `update_updated_at()` / `set_updated_at()`
Atualiza automaticamente o campo `updated_at` antes de qualquer UPDATE. Aplicado em quase todas as tabelas.

---

## 🔁 Triggers

Triggers são gatilhos que executam funções automaticamente em resposta a eventos no banco.

| Trigger | Tabela | Evento | Função executada |
|---|---|---|---|
| `trg_create_profile` | `auth.users` | INSERT (AFTER) | `handle_new_user()` |
| `trg_validate_appointment_opening_hours` | `appointments` | INSERT, UPDATE (BEFORE) | `validate_appointment_opening_hours()` |
| `trg_check_appointment_conflict` | `appointments` | INSERT, UPDATE (BEFORE) | `check_appointment_conflict()` |
| `trg_appointments_updated_at` | `appointments` | UPDATE (BEFORE) | `update_updated_at()` |
| `enforce_barber_plan_limit` | `barbers` | INSERT, UPDATE (BEFORE) | `check_barber_plan_limit()` |
| `trg_barbers_updated_at` | `barbers` | UPDATE (BEFORE) | `update_updated_at()` |
| `on_plan_downgrade` | `barbershops` | UPDATE (AFTER) | `enforce_barber_limit_on_plan_change()` |
| `on_plan_downgrade_services` | `barbershops` | UPDATE (AFTER) | `enforce_service_limit_on_plan_change()` |
| `trg_barbershops_updated_at` | `barbershops` | UPDATE (BEFORE) | `update_updated_at()` |
| `trigger_check_opening_hours_overlap` | `opening_hours` | INSERT, UPDATE (BEFORE) | `check_opening_hours_overlap()` |
| `trg_barber_availability_updated_at` | `barber_availability` | UPDATE (BEFORE) | `set_updated_at()` |
| `enforce_service_plan_limit` | `services` | INSERT, UPDATE (BEFORE) | `check_service_plan_limit()` |
| `trg_services_updated_at` | `services` | UPDATE (BEFORE) | `update_updated_at()` |
| `trg_addresses_updated_at` | `addresses` | UPDATE (BEFORE) | `update_updated_at()` |
| `trg_profiles_updated_at` | `profiles` | UPDATE (BEFORE) | `update_updated_at()` |

> ⚠️ Existe um trigger `trg_create_profile` também em `public.profiles` que pode causar loop — deve ser removido. Apenas o trigger em `auth.users` é necessário.

---

## 🔒 Policies (RLS — Row Level Security)

RLS é o sistema de controle de acesso em nível de linha do PostgreSQL. Cada query feita ao banco passa pelas policies da tabela antes de retornar dados.

**Conceito básico:** uma policy define QUEM pode fazer QUAL operação em QUAIS linhas.

```sql
-- Exemplo: cliente só vê seus próprios agendamentos
create policy "customers can view own appointments"
on appointments for select
using (
  customer_id in (
    select id from customers where auth_user_id = auth.uid()
  )
);
```

`auth.uid()` retorna o UUID do usuário autenticado via JWT. Se não houver usuário autenticado, retorna `null`.

### Resumo das policies por tabela

| Tabela | Quem pode ler | Quem pode escrever |
|---|---|---|
| `barbershops` | Público (barbearias ativas) | Dono |
| `barbers` | Público | Dono, membro admin |
| `services` | Público | Dono, membro admin |
| `barber_services` | Público (barbearias ativas) | Dono, membro admin |
| `opening_hours` | Público | Dono |
| `appointments` | Cliente (os próprios), barbeiro (os próprios), dono/membro | Cliente (inserir), dono/membro (tudo) |
| `customers` | Dono, membro, o próprio cliente | Dono, membro, o próprio cliente |
| `profiles` | O próprio usuário | O próprio usuário |
| `barbershop_members` | Dono, membros | Dono |
| `barbershop_gallery` | Público (barbearias ativas) | Dono, membro admin |
| `addresses` | Público | Dono |
| `social_media` | Público | Dono |
| `store_style` | Público | Dono |

---

## ☁️ Edge Functions

Edge Functions são funções serverless que rodam no servidor Supabase usando **Deno** (runtime JavaScript/TypeScript). Elas têm acesso à `service_role` key, que ignora o RLS e permite operações administrativas.

> ⚠️ Os arquivos das Edge Functions ficam em `supabase/functions/` no repositório. Para editar, altere os arquivos localmente e faça deploy via CLI: `npx supabase functions deploy nome-da-function`

### `create-member`
**Endpoint:** `POST /functions/v1/create-member`

Cria um novo membro da equipe de uma barbearia. Utiliza a `service_role` porque precisa criar usuários diretamente em `auth.users`, o que não é possível pelo cliente público.

**Fluxo:**
1. Valida que o requester é dono da barbearia
2. Verifica se o username já está em uso nessa barbearia
3. Cria o usuário em `auth.users` com email sintético `{username}@{barbershop_id}.member`
4. Cria o perfil em `public.profiles`
5. Vincula na tabela `barbershop_members`

**Body esperado:**
```json
{
  "username": "string",
  "password": "string",
  "role": "admin" | "reader",
  "barbershop_id": "uuid"
}
```

---

### `delete-member`
**Endpoint:** `POST /functions/v1/delete-member`

Remove completamente um membro — deleta o usuário de `auth.users` (em cascata remove `profiles` e `barbershop_members`).

**Body esperado:**
```json
{
  "member_id": "uuid"
}
```

---

### `update-member-password`
**Endpoint:** `POST /functions/v1/update-member-password`

Altera a senha de um membro. Só o dono da barbearia pode executar.

**Body esperado:**
```json
{
  "member_id": "uuid",
  "password": "string"
}
```

---

## 🗄️ Storage

O Supabase Storage armazena arquivos (imagens) em buckets. No projeto há 3 buckets:

| Bucket | Público | Tamanho máximo | Tipos permitidos | Uso |
|---|---|---|---|---|
| `barbershop-assets` | ✅ Sim | 15 MB | `image/*` | Logos, banners, fotos de barbeiros e imagens de serviços |
| `Virtual_barber` | ✅ Sim | 10 MB | `image/*` | Uso geral de assets da plataforma |
| `gallery` | ✅ Sim | Sem limite | Sem restrição | Fotos da galeria de barbearias |

### Como as imagens são organizadas no `barbershop-assets`

O caminho dos arquivos segue a convenção:
```
{owner_id}/services/{service_id}.{ext}
{owner_id}/barbers/{barber_id}.{ext}
```

As imagens são salvas com **signed URLs** que expiram em 1 ano. Isso garante que mesmo sendo um bucket público, as URLs não são advinhadas facilmente.

---

## 🧩 Extensions

Extensions adicionam funcionalidades ao PostgreSQL. As ativas no projeto:

| Extension | Versão | Para que serve |
|---|---|---|
| `plpgsql` | 1.0 | Linguagem procedural para funções SQL (base do Postgres) |
| `pgcrypto` | 1.3 | Geração de UUIDs e funções criptográficas |
| `uuid-ossp` | 1.1 | Geração de UUIDs (alternativa ao `gen_random_uuid()`) |
| `pg_cron` | 1.6.4 | Agendamento de jobs — usado para executar `mark_no_show_appointments()` periodicamente |
| `pg_graphql` | 1.5.11 | API GraphQL automática gerada a partir do schema (não usada ativamente) |
| `pg_stat_statements` | 1.11 | Monitoramento de performance de queries |
| `supabase_vault` | 0.3.1 | Armazenamento seguro de secrets no banco |

---

## 📡 Realtime (Publication)

A publication `supabase_realtime` configura quais tabelas podem emitir eventos em tempo real para o frontend via WebSocket.

| Publication | Configuração atual |
|---|---|
| `supabase_realtime` | `puballtables: false` (não inclui todas as tabelas automaticamente) |

Suporta eventos de INSERT, UPDATE e DELETE. Para assinar uma tabela no frontend:

```typescript
supabase
  .channel('appointments')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'appointments',
    filter: `barbershop_id=eq.${barbershopId}`
  }, (payload) => {
    console.log('Mudança:', payload)
  })
  .subscribe()
```

> Para uma tabela aparecer no Realtime, ela precisa ser adicionada à publication via Dashboard em **Database → Replication**.

---

## 👥 Roles do PostgreSQL

O Supabase usa roles do PostgreSQL para controlar o acesso à API:

| Role | Quem é | Acesso |
|---|---|---|
| `anon` | Usuário não autenticado | Só o que as policies `to public` permitem |
| `authenticated` | Usuário com JWT válido | O que as policies `to authenticated` ou `to public` permitem |
| `service_role` | Backend/Edge Functions com service_role key | Ignora RLS completamente — acesso total |

No frontend, sempre use a **anon key** (publishable). A **service_role key** só deve estar nas Edge Functions e nunca exposta no cliente.

---

## 🔄 Fluxos Importantes

### Fluxo: Cadastro de barbearia
```
1. Usuário preenche formulário de cadastro
2. Frontend chama supabase.auth.signUp({ email, password })
3. Supabase cria auth.users → trigger → profiles (role: 'barbershop')
4. Usuário preenche dados da barbearia
5. Frontend chama a RPC: supabase.rpc('register_barbershop', {...})
6. Função cria o slug, insere em barbershops e atualiza profiles.name
```

### Fluxo: Login de membro
```
1. Membro acessa a página da barbearia (ex: /tropicos-barber/login)
2. Frontend chama get_member_auth_email(username, slug)
3. Banco retorna o email sintético: vitor@{barbershop_id}.member
4. Frontend faz signInWithPassword com esse email e a senha do membro
5. Membro recebe JWT e acessa o painel
```

### Fluxo: Agendamento (cliente OAuth)
```
1. Cliente acessa a página pública da barbearia
2. Clica em "Entrar com Google" → supabase.auth.signInWithOAuth()
3. Após login: frontend verifica se existe customers registro para esse auth_user_id + barbershop_id
4. Se não existir: cria o registro em customers
5. Cliente escolhe barbeiro, serviço e horário
6. Frontend verifica disponibilidade de slots
7. Frontend faz INSERT em appointments
8. Triggers validam: horário de funcionamento + conflito de agenda
9. Agendamento criado com status 'scheduled'
```

### Fluxo: Adição de membro
```
1. Dono acessa painel de membros
2. Preenche username, senha e role
3. Frontend chama Edge Function create-member (com Authorization header)
4. Edge Function valida ownership, cria auth.users com email sintético
5. Cria profiles e barbershop_members
6. Membro pode fazer login imediatamente
```

### Fluxo: Downgrade de plano
```
1. Dono muda plano de 'profissional' para 'iniciante'
2. UPDATE em barbershops.plan dispara trigger on_plan_downgrade
3. Função enforce_barber_limit_on_plan_change() conta barbeiros ativos
4. Se exceder o novo limite (1 para iniciante), desativa os mais recentes
5. Mesmo processo para serviços via on_plan_downgrade_services
```

---

## 📝 Convenções e Boas Práticas

- Nunca use a `service_role` key no frontend
- Toda nova tabela deve ter RLS habilitado (`alter table X enable row level security`)
- Use `supabase.rpc('nome_da_funcao', params)` para chamar functions do banco
- Para operações que precisam de `service_role`, crie uma Edge Function
- Timestamps são armazenados em UTC. O frontend converte para o fuso do usuário
- O slug da barbearia é imutável após criação (não existe função de atualização de slug)
- A pasta `supabase/.temp/` deve estar no `.gitignore` — é gerada automaticamente pelo CLI

---

## 🛠️ Comandos Úteis do CLI

```bash
# Linkar com o projeto remoto
npx supabase link --project-ref SEU_PROJECT_REF

# Fazer deploy de uma Edge Function
npx supabase functions deploy create-member

# Ver histórico de migrations
npx supabase migration list

# Reparar migration com problema
npx supabase migration repair --status applied 20260318000000
```

---

*Documentação gerada com base no estado do banco em março de 2026.*
