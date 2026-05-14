# Virtual Barber - Frontend da Barbearia

Painel web administrativo do sistema Virtual Barber, construido com React,
TypeScript, Vite e Supabase.

Este projeto e o lado da barbearia: dashboard, agenda, clientes, servicos,
equipe, relatorios, configuracoes e personalizacao da loja.

---

## Tecnologias

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase Auth
- Supabase Database
- Supabase Storage
- Recharts
- Radix UI / shadcn-style components
- Zustand

---

## Funcionalidades

- Cadastro, login, recuperacao e troca de senha.
- Protecao de rotas autenticadas.
- Dashboard com KPIs, agenda do dia e graficos.
- Criacao, listagem e cancelamento de agendamentos.
- Controle de conflitos de horario por barbeiro e cliente.
- Conversao de horarios UTC do banco para `America/Sao_Paulo` no frontend.
- Cadastro e edicao de clientes.
- Historico de agendamentos por cliente.
- Cadastro, edicao, ativacao e desativacao de servicos.
- Cadastro, edicao, ativacao e desativacao de barbeiros.
- Disponibilidade personalizada por profissional.
- Configuracao de horario de funcionamento da barbearia.
- Configuracao de endereco, logo, banner e estilo visual.
- Relatorios de faturamento, servicos, barbeiros, dias e horarios.

---

## Como Rodar

Instale as dependencias:

```bash
npm install
```

Crie um arquivo `.env` na raiz:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

Rode em desenvolvimento:

```bash
npm run dev
```

Gere build de producao:

```bash
npm run build
```

---

## Supabase

O projeto nao possui backend proprio. Autenticacao, banco, storage e funcoes
serverless ficam no Supabase.

Scripts SQL locais ficam em `src/database`:

1. `01_enums.sql`
2. `02_tables.sql`
3. `03_triggers.sql`
4. `04_rls.sql`
5. `05_members.sql`
6. `06_soft_delete_appointments.sql`

Tabelas principais:

- `barbershops`
- `addresses`
- `barbers`
- `barber_availability`
- `services`
- `barber_services`
- `customers`
- `appointments`
- `opening_hours`
- `store_style`

---

## Regra de Horario

O banco salva datas em UTC. O frontend interpreta e exibe horarios no fuso:

```ts
America/Sao_Paulo
```

O helper central fica em:

- `src/utils/date-time.ts`

Use esse helper sempre que precisar:

- formatar horario vindo do Supabase;
- gerar ISO para salvar agendamento;
- montar range local de dia ou mes para consultar o banco;
- agrupar ou comparar agendamentos por data local.

---

## Estrutura do `src`

### Raiz de `src`

- `main.tsx`  
  Ponto de entrada da aplicacao React. Renderiza a arvore principal no DOM.

- `index.css`  
  Estilos globais, tokens visuais e configuracoes base do Tailwind.

---

## `src/assets`

- `react.svg`  
  Asset padrao do template React/Vite. Pode ser removido se nao estiver em uso.

---

## `src/components`

Pasta principal de componentes reutilizaveis e telas compostas.

### `src/components/common`

- `appointments-hour-chart.tsx`  
  Grafico de agendamentos por horario, com agrupamento por status.

- `barbers-chart.tsx`  
  Grafico de desempenho ou volume por barbeiro.

- `barbershop-calendar.tsx`  
  Calendario usado em fluxos visuais da barbearia.

- `barbershop-gallery.tsx`  
  Componente de galeria/imagens da barbearia.

- `header-page.tsx`  
  Cabecalho reutilizavel de paginas internas.

- `logo.tsx`  
  Renderizacao do logo/nome visual do sistema.

- `opening-hours-section.tsx`  
  Secao de exibicao ou edicao dos horarios de funcionamento.

- `plans-section.tsx`  
  Secao visual de planos do produto.

- `services-chart.tsx`  
  Grafico relacionado aos servicos mais usados ou mais vendidos.

- `sidebar.tsx`  
  Navegacao lateral principal do painel.

- `toaster.tsx`  
  Componente global de notificacoes.

- `user-section.tsx`  
  Area de usuario no layout, geralmente com dados e acoes da conta.

- `weekday-chart.tsx`  
  Grafico de agendamentos por dia da semana.

### `src/components/forms`

- `address-form.tsx`  
  Formulario de endereco da barbearia.

- `barbershop-settings-form.tsx`  
  Formulario de configuracoes gerais da barbearia.

- `login-form.tsx`  
  Formulario de login por email e senha.

- `security-settings-form.tsx`  
  Formulario de seguranca da conta, como troca de senha/email.

- `signup-form.tsx`  
  Formulario de cadastro inicial.

### `src/components/main`

- `appointments-main.tsx`  
  Tela principal de agenda. Lista agendamentos por periodo, status, horario e
  permite abrir criacao/cancelamento.

- `customers-main.tsx`  
  Tela principal de clientes, com listagem, busca e acoes de cadastro/edicao.

- `dashboard-main.tsx`  
  Tela principal do dashboard, com KPIs, agenda do dia e graficos.

- `manage-store-style.tsx`  
  Tela de personalizacao visual da loja.

- `manage-team-main.tsx`  
  Tela principal de equipe/profissionais.

- `reports-main.tsx`  
  Tela principal de relatorios.

- `services-main.tsx`  
  Tela principal de gerenciamento de servicos.

- `settings-main.tsx`  
  Tela principal de configuracoes da barbearia e da conta.

### `src/components/manage-store-style`

- `color-field.tsx`  
  Campo de selecao/edicao de cor.

- `style-control-bar.tsx`  
  Barra de controles da personalizacao visual.

### `src/components/modals/appointments`

- `delete-appointment-appointment.tsx`  
  Modal de cancelamento de agendamento pela barbearia.

#### `src/components/modals/appointments/create-appointmend-modal`

- `create-appointment-modal.tsx`  
  Modal pai do fluxo de criacao de agendamento. Controla etapas, estado e
  insert final no Supabase.

#### `src/components/modals/appointments/create-appointmend-modal/components`

- `confirm-step.tsx`  
  Etapa final de revisao antes de confirmar o agendamento.

- `field.tsx`  
  Campo visual reutilizavel dentro do modal.

- `step-1.tsx`  
  Escolha ou criacao/identificacao do cliente.

- `step-2.tsx`  
  Escolha dos servicos.

- `step-3.tsx`  
  Escolha da data.

- `step-4.tsx`  
  Escolha de profissional e horario. Calcula slots por expediente da barbearia,
  disponibilidade do barbeiro, agendamentos existentes e duracao do servico.

- `step-indicator.tsx`  
  Indicador visual das etapas do fluxo.

### `src/components/modals/customers`

- `create-customer-modal.tsx`  
  Modal de cadastro de cliente manual.

- `customer-conflict-modal.tsx`  
  Modal para resolver conflito entre clientes duplicados ou similares.

- `customer-history-modal.tsx`  
  Modal com historico de agendamentos do cliente.

- `update-customer-modal.tsx`  
  Modal de edicao de dados do cliente.

### `src/components/modals/manage-services`

- `create-service-modal.tsx`  
  Modal para criar novo servico.

- `update-service-modal.tsx`  
  Modal para editar servico existente.

### `src/components/modals/manage-team`

- `availability-section.tsx`  
  Secao de configuracao de disponibilidade personalizada do profissional.

- `create-barber-modal.tsx`  
  Modal para criar profissional.

- `update-barber-modal.tsx`  
  Modal para editar profissional existente.

### `src/components/modals/password`

- `password-confirm-modal.tsx`  
  Modal de confirmacao de senha para acoes sensiveis.

### `src/components/modals/plans`

- `plans-modal.tsx`  
  Modal de visualizacao ou selecao de planos.

### `src/components/modals/settings`

- `email-change-confirmation-modal.tsx`  
  Modal de confirmacao para alteracao de email.

### `src/components/skeleton`

- `customers-skeleton.tsx`  
  Loading skeleton da tela de clientes.

- `dashboard-skeleton.tsx`  
  Loading skeleton do dashboard.

- `manage-team-skeleton.tsx`  
  Loading skeleton da tela de equipe.

- `reports-skeleton.tsx`  
  Loading skeleton da tela de relatorios.

- `services-skeleton.tsx`  
  Loading skeleton da tela de servicos.

- `settings-skeleton.tsx`  
  Loading skeleton da tela de configuracoes.

### `src/components/ui`

Componentes base de interface, usados como building blocks.

- `alert-dialog.tsx`  
  Dialog de alerta/confirmacao.

- `alert.tsx`  
  Componente de alerta.

- `avatar.tsx`  
  Avatar de usuario/profissional.

- `badge-variants.tsx`  
  Variantes visuais de badge.

- `badge.tsx`  
  Badge reutilizavel.

- `button-variants.tsx`  
  Variantes visuais de botao.

- `button.tsx`  
  Botao reutilizavel.

- `calendar.tsx`  
  Calendario base.

- `card.tsx`  
  Componentes de card.

- `chart.tsx`  
  Wrappers e helpers visuais para graficos.

- `checkbox.tsx`  
  Checkbox.

- `dialog.tsx`  
  Dialog/modal base.

- `dropdown-menu.tsx`  
  Menu suspenso.

- `field.tsx`  
  Campo de formulario.

- `image-cropped.tsx`  
  Componente de recorte/preview de imagem.

- `input-group.tsx`  
  Grupo de input com elementos auxiliares.

- `input.tsx`  
  Input base.

- `label.tsx`  
  Label de formulario.

- `popover.tsx`  
  Popover.

- `select.tsx`  
  Select.

- `separator.tsx`  
  Separador visual.

- `sheet.tsx`  
  Painel lateral/modal tipo sheet.

- `sidebar.tsx`  
  Componentes base para sidebar.

- `skeleton.tsx`  
  Skeleton base.

- `spinner.tsx`  
  Indicador de carregamento.

- `switch.tsx`  
  Toggle switch.

- `table.tsx`  
  Componentes base de tabela.

- `textarea.tsx`  
  Textarea.

- `tooltip.tsx`  
  Tooltip.

---

## `src/constants`

- `plans.ts`  
  Constantes e configuracoes dos planos do produto.

---

## `src/database`

- `01_enums.sql`  
  Cria enums usados pelo banco.

- `02_tables.sql`  
  Cria tabelas principais.

- `03_triggers.sql`  
  Cria funcoes e triggers.

- `04_rls.sql`  
  Define Row Level Security e policies.

- `05_members.sql`  
  Estrutura complementar para membros/equipe.

- `06_soft_delete_appointments.sql`  
  Ajustes para cancelamento/soft delete de agendamentos.

---

## `src/hooks`

- `use-all-customers.ts`  
  Busca todos os clientes da barbearia.

- `use-appointments.ts`  
  Busca agendamentos por periodo e resolve cliente manual/autenticado.

- `use-auth.ts`  
  Estado e verificacoes de autenticacao.

- `use-barber-availability.ts`  
  Busca e normaliza disponibilidade dos profissionais.

- `use-barber-shop-data.ts`  
  Busca dados principais da barbearia.

- `use-barbers.ts`  
  Busca profissionais da barbearia.

- `use-barbershop-services.ts`  
  Busca servicos da barbearia.

- `use-customers-auth-with-appointments.ts`  
  Busca clientes autenticados com dados de agendamento.

- `use-customers.ts`  
  Busca clientes manuais.

- `use-dashboard.ts`  
  Carrega dados do dashboard: agenda do dia, faturamento, servicos e equipe.

- `use-future-appointments-count.ts`  
  Conta agendamentos futuros.

- `use-logout.ts`  
  Encapsula logout.

- `use-mobile.ts`  
  Detecta comportamento responsivo/mobile.

- `use-opening-hours.ts`  
  Busca horarios de funcionamento.

- `use-reports.ts`  
  Carrega dados agregados para relatorios.

- `use-service.ts`  
  Busca servicos.

- `use-settings-alerts.ts`  
  Calcula alertas de configuracao incompleta.

---

## `src/lib`

- `utils.ts`  
  Utilitarios gerais, incluindo merge de classes CSS.

### `src/lib/supabase`

- `lazy-supabase.ts`  
  Carregamento lazy do cliente Supabase.

- `supabase.ts`  
  Cliente Supabase principal.

### `src/lib/supabase/barbers`

- `create-barber.ts`  
  Cria profissional.

- `delete-barber.ts`  
  Remove ou desativa profissional.

- `toggle-active-barber.ts`  
  Alterna status ativo/inativo do profissional.

- `update-barber.ts`  
  Atualiza dados do profissional.

### `src/lib/supabase/customers`

- `create-customer.ts`  
  Cria cliente.

- `delete-customer.ts`  
  Remove cliente.

- `update-customer.ts`  
  Atualiza cliente.

### `src/lib/supabase/opening-hours`

- `upsert-opening-hours.ts`  
  Cria ou atualiza horarios de funcionamento.

### `src/lib/supabase/services`

- `create-service.ts`  
  Cria servico.

- `delete-service.ts`  
  Remove servico.

- `toggle-active-service.tsx`  
  Alterna status ativo/inativo do servico.

- `update-service.ts`  
  Atualiza servico.

### `src/lib/supabase/storage`

- `get-optimized-public-image-url.ts`  
  Gera URL publica otimizada de imagem.

- `handle-upload-banner.ts`  
  Fluxo de upload do banner.

- `handle-upload-logo.ts`  
  Fluxo de upload do logo.

- `upload-image.ts`  
  Helper generico de upload de imagem.

---

## `src/pages`

- `appointments-page.tsx`  
  Pagina da agenda.

- `confirmation-email-page.tsx`  
  Pagina de confirmacao de email.

- `customers-page.tsx`  
  Pagina de clientes.

- `dashboard-page.tsx`  
  Pagina do dashboard.

- `forgot-password-page.tsx`  
  Pagina de solicitacao de recuperacao de senha.

- `login-page.tsx`  
  Pagina de login.

- `manage-service-page.tsx`  
  Pagina de servicos.

- `manage-store-style-page.tsx`  
  Pagina de personalizacao da loja.

- `manage-team-page.tsx`  
  Pagina de equipe.

- `reports-page.tsx`  
  Pagina de relatorios.

- `reset-password-page.tsx`  
  Pagina de redefinicao de senha.

- `settings-page.tsx`  
  Pagina de configuracoes.

- `signup-page.tsx`  
  Pagina de cadastro.

- `signup-pending-page.tsx`  
  Pagina exibida apos cadastro pendente.

---

## `src/routes`

- `app-routes.tsx`  
  Define as rotas da aplicacao.

- `protected-route.tsx`  
  Wrapper para rotas que exigem usuario autenticado.

- `public-route.tsx`  
  Wrapper para rotas publicas.

---

## `src/store`

- `barbershop.store.ts`  
  Store global da barbearia atual.

- `settings-alerts.store.ts`  
  Store de alertas de configuracao.

---

## `src/types`

- `barber.ts`  
  Tipos relacionados a profissionais.

- `barbershop.ts`  
  Tipos relacionados a barbearia.

- `create-appointment.ts`  
  Tipos do fluxo de criacao e exibicao de agendamentos.

- `customer.ts`  
  Tipos de cliente.

- `opening-hours.ts`  
  Tipos de horario de funcionamento.

- `services.tsx`  
  Tipos de servicos.

- `store-style.tsx`  
  Tipos de estilo visual da loja.

---

## `src/utils`

- `check-email-exist.ts`  
  Verifica existencia de email.

- `date-time.ts`  
  Helper central de timezone, UTC, horario local do Brasil e ranges de data.

- `format-phone.ts`  
  Formata telefone.

- `masked-input-phone.ts`  
  Mascara de input de telefone.

- `validate-availability.constants.ts`  
  Validacoes e mensagens para disponibilidade de profissionais.

- `verify-password.ts`  
  Regras de validacao de senha.

---

## Comandos Uteis

```bash
npm run dev
npm run build
npm run lint
```

---

## Observacoes de Manutencao

- Para novos fluxos de agenda, use `src/utils/date-time.ts`.
- Para novas chamadas ao Supabase, prefira centralizar em `src/lib/supabase`
  quando a operacao for reutilizavel.
- Para novas telas, mantenha a separacao: `pages` monta a pagina e
  `components/main` concentra a interface principal.
- Para novos componentes base, use `src/components/ui`.
