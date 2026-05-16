# Contexto específico do projeto

Este projeto é o painel web da barbearia dentro do SaaS Virtual Barber. Ele não é o app do cliente final nem o console interno do SaaS: é a área administrativa usada por proprietários e colaboradores da barbearia para operar agenda, clientes, equipe, serviços, relatórios e configurações.

## Função deste projeto dentro do SaaS

O projeto representa o lado da barbearia. Ele permite que uma barbearia gerencie sua operação diária e sua presença pública no SaaS:

- autenticação do proprietário por email e senha;
- autenticação de colaboradores por slug da barbearia, nome de usuário e senha;
- dashboard com indicadores operacionais;
- agenda e criação manual de agendamentos;
- cadastro e manutenção de clientes;
- cadastro, ativação e desativação de profissionais;
- cadastro, ativação e desativação de serviços;
- definição de horários de funcionamento e disponibilidade dos profissionais;
- edição de dados, endereço, galeria e estilo visual da página pública;
- gestão de membros/usuários da barbearia;
- relatórios de faturamento, atendimento, serviços, profissionais, dias e horários.

A aplicação é um frontend React/Vite que conversa diretamente com Supabase para Auth, Database, Storage, Realtime e Edge Functions.

## Principais páginas

As rotas ficam em `src/routes/app-routes.tsx`.

- `/entrar`: login do proprietário e de colaboradores.
- `/cadastro`: cadastro inicial da barbearia.
- `/cadastro-pendente/:email`: estado de cadastro pendente por email não confirmado.
- `/esqueci-minha-senha`: solicitação de recuperação de senha.
- `/criar-nova-senha`: criação de nova senha após fluxo de recovery do Supabase.
- `/auth/email-change-confirmed`: confirmação de alteração de email.
- `/`: dashboard principal.
- `/agenda`: agenda da barbearia e criação de agendamentos.
- `/clientes`: listagem, criação, edição e histórico de clientes.
- `/equipe`: gerenciamento de barbeiros/profissionais.
- `/servicos`: gerenciamento de serviços.
- `/editar-pagina`: personalização visual da página pública da barbearia.
- `/relatorios`: relatórios operacionais e financeiros.
- `/configuracoes`: dados da barbearia, segurança, endereço, horários, galeria e usuários.

## Principais componentes

- `src/components/main/dashboard-main.tsx`: tela principal do dashboard.
- `src/components/main/appointments-main.tsx`: listagem e filtro de agendamentos por período, alteração de status e abertura do modal de novo agendamento.
- `src/components/main/customers-main.tsx`: gestão de clientes.
- `src/components/main/manage-team-main.tsx`: gestão da equipe.
- `src/components/main/services-main.tsx`: gestão de serviços.
- `src/components/main/reports-main.tsx`: relatórios e gráficos.
- `src/components/main/settings-main.tsx`: tela de configurações com seções carregadas sob demanda.
- `src/components/main/manage-store-style.tsx`: personalização de estilo e preview da loja pública via iframe.
- `src/components/common/sidebar.tsx`: navegação lateral do painel autenticado.
- `src/components/common/opening-hours-section.tsx`: edição dos horários de funcionamento.
- `src/components/common/barbershop-gallery.tsx`: galeria/imagens da barbearia.
- `src/components/common/user-section.tsx`: criação, edição e remoção de colaboradores.
- `src/components/forms/login-form.tsx`: login do proprietário e do colaborador.
- `src/components/forms/signup-form.tsx`: cadastro da barbearia.
- `src/components/forms/barbershop-settings-form.tsx`: dados gerais da barbearia.
- `src/components/forms/address-form.tsx`: endereço.
- `src/components/forms/security-settings-form.tsx`: segurança da conta.
- `src/components/modals/appointments/create-appointmend-modal/create-appointment-modal.tsx`: fluxo de criação manual de agendamento em etapas.
- `src/components/modals/appointments/create-appointmend-modal/components/step-4.tsx`: cálculo e seleção de barbeiro/horário.
- `src/components/modals/customers/*`: criação, edição, histórico e resolução de conflito de clientes.
- `src/components/modals/manage-services/*`: criação e edição de serviços.
- `src/components/modals/manage-team/*`: criação/edição de profissionais e disponibilidade.
- `src/components/ui/*`: base visual no estilo shadcn/Radix, usada como camada de componentes primitivos.

## Principais hooks

- `useAuth`: lê sessão do Supabase Auth e mantém estado de login.
- `useBarbershopData`: identifica a barbearia atual. Primeiro tenta carregar como proprietário por `barbershops.owner_id`; se não encontrar, usa RPC para descobrir a barbearia do membro.
- `useAppointments`: busca agendamentos por período e resolve dados de clientes autenticados ou manuais.
- `useDashboard`: carrega agenda do dia, faturamento mensal, clientes, serviços, profissionais e top serviços. Também escuta Realtime para serviços e barbeiros.
- `useReports`: monta KPIs e agregações para relatórios por intervalo e, opcionalmente, por barbeiro.
- `useServices` / `useBarbershopServices`: carregam serviços da barbearia.
- `useBarbers`: carrega profissionais.
- `useBarberAvailability`: carrega e normaliza disponibilidade dos profissionais.
- `useOpeningHours`: carrega horários de funcionamento.
- `useAllCustomers`: carrega clientes da barbearia.
- `useFutureAppointmentsCount`: conta agendamentos futuros.
- `useSettingsAlerts`: calcula alertas de configurações incompletas, como endereço ou horários.
- `useSettingsAlertsStore`: dispara recarregamento dos alertas.
- `useLogout`: encapsula logout.
- `useMobile`: detecção responsiva.

## Principais stores

- `src/store/barbershop.store.ts`: store Zustand da barbearia atual. Guarda `barbershop`, `memberRole` e `memberUsername`. Os papéis usados no frontend são `owner`, `admin` e `reader`.
- `src/store/settings-alerts.store.ts`: store Zustand simples com um contador `tick` usado para forçar recarregamento dos alertas de configuração.

## Integração com Supabase

O cliente Supabase principal fica em `src/lib/supabase/supabase.ts`, usando:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_ANON_KEY`.

Também existe `src/lib/supabase/lazy-supabase.ts`, usado em alguns hooks para carregar o cliente sob demanda.

Áreas usadas:

- Auth: login, sessão, recuperação de senha, confirmação de email e criação de usuários internos via Edge Functions.
- Database: queries diretas para tabelas como `barbershops`, `appointments`, `customers`, `services`, `barbers`, `opening_hours`, `barber_availability`, `barber_services`, `barbershop_members` e `store_style`.
- Storage: upload de logo, banner e imagens da galeria em `src/lib/supabase/storage/*`.
- Functions: `create-member`, `update-member`, `delete-member` e `prepare-pending-signup`.
- RPCs: usadas para membros, como `get_my_member_barbershop_id`, `get_member_auth_email` e `get_barbershop_members`.
- Realtime: `useDashboard` escuta mudanças nas tabelas `services` e `barbers` para atualizar indicadores.

Os scripts SQL locais estão em `src/database`, mas existe uma documentação mais completa do backend em `supabase/README.md`. Ao mexer em integração com banco, não assuma que `src/database` reflete sozinho o estado final do Supabase.

## Fluxos principais

### Login do proprietário

O formulário em `src/components/forms/login-form.tsx` usa `supabase.auth.signInWithPassword` com email e senha. Se o Supabase responder `Email not confirmed`, o frontend chama a Edge Function `prepare-pending-signup`, salva dados em `sessionStorage` e redireciona para `/cadastro-pendente/:email`.

### Login do colaborador

O colaborador informa slug da barbearia, username e senha. O frontend chama a RPC `get_member_auth_email` para transformar `username + slug` em um email sintético interno. Depois usa esse email no `signInWithPassword`.

### Carregamento da barbearia atual

`useBarbershopData` decide se o usuário logado é proprietário ou membro. Proprietário é identificado por `barbershops.owner_id`. Membro é identificado via `get_my_member_barbershop_id` e tabela `barbershop_members`. Se não houver barbearia válida para a sessão, o hook faz logout.

### Proteção de rotas

`ProtectedRoute` exige sessão e barbearia carregada. Membros com papel `reader` só acessam `/agenda`. Membros que não são `owner` não acessam `/configuracoes`. As demais restrições de escrita dependem de RLS, Edge Functions e validações do próprio componente.

### Criação de agendamento

O modal de criação segue etapas:

1. selecionar ou criar cliente;
2. selecionar um ou mais serviços;
3. escolher data;
4. escolher profissional e horário por serviço;
5. confirmar.

O cálculo de slots considera horário de funcionamento da barbearia, disponibilidade personalizada do barbeiro, duração do serviço, agendamentos existentes e conflitos entre múltiplos serviços selecionados no mesmo fluxo.

### Alteração de status de agendamento

Na agenda, o status pode ser alterado para `scheduled`, `completed`, `no_show` ou `cancelled_by_barbershop`, respeitando restrições visuais para agendamentos cancelados pelo cliente e horários passados.

### Gestão de membros

Na seção de usuários, apenas `owner` cria, edita ou remove membros. A criação usa a Edge Function `create-member`, que cria um usuário no Auth com email sintético e vincula em `barbershop_members`. Edição e remoção usam `update-member` e `delete-member`.

### Personalização da loja pública

`/editar-pagina` carrega/salva dados em `store_style` e exibe um iframe apontando para `VITE_PREVIEW_ORIGIN/{slug}?preview=true`. Alterações são enviadas ao iframe por `postMessage` com tipo `BARBERSHOP_PREVIEW_STYLE`.

## Regras de negócio

- Datas de agendamentos são salvas em UTC no banco, mas a experiência do painel usa `America/Sao_Paulo`. O helper central é `src/utils/date-time.ts`.
- Para agenda, relatórios e dashboard, use os helpers de range local (`getLocalDayRange`, `getLocalInclusiveDayRange`, `getLocalMonthRange`) antes de consultar Supabase.
- Um agendamento ativo não pode conflitar com outro agendamento ativo do mesmo barbeiro. O frontend evita conflitos e o banco também deve validar.
- Status considerados inativos para bloqueio de agenda: `cancelled_by_customer`, `cancelled_by_barbershop` e `no_show`.
- Relatórios de receita consideram apenas agendamentos `completed`.
- `reader` é colaborador de acesso restrito à agenda.
- `admin` tem acesso amplo ao painel, mas não às configurações.
- `owner` é o proprietário da barbearia e pode acessar configurações e gerenciar membros.
- Clientes podem ser autenticados ou manuais. Agendamentos podem referenciar `customer_id` ou `manual_customer_id`; preserve essa distinção.
- Serviços e profissionais possuem `is_active`; normalmente são desativados em vez de removidos da operação.
- A exclusão/remoção de entidades deve preservar histórico de agendamentos quando possível.
- Horários de funcionamento e disponibilidade aceitam múltiplos períodos por dia via `period_order`.
- O nome da barbearia tem constraint de tamanho máximo no Supabase.
- O frontend usa imagens públicas/otimizadas do Supabase Storage para logo, banner, galeria e avatar.

## Problemas encontrados

- Há divergência entre os SQL antigos em `src/database` e o estado que o frontend parece esperar. Exemplos: os scripts iniciais citam `service_barbers`, mas o código usa `barber_services`; o código também usa `manual_customer_id`, `period_order`, `username` em `barbershop_members`, `barber_availability` e `store_style`, que não aparecem nos scripts iniciais lidos.
- A documentação `supabase/README.md` parece mais atualizada que parte dos scripts de `src/database`; use-a como referência complementar, mas valide contra o projeto Supabase real antes de fazer migrações.
- Algumas strings/comentários aparecem com caracteres quebrados em arquivos do projeto, sugerindo problema de encoding em partes do código/documentação.
- `LoginForm` redireciona para `/painel` após login, mas as rotas protegidas deste projeto usam `/` como dashboard. Pode haver redirecionamento externo, histórico legado ou bug a confirmar antes de alterar.
- Existem `console.log` de debug no fluxo de criação de agendamento.
- O diretório `create-appointmend-modal` tem erro de digitação no nome, mas já é o caminho usado pelo código.
- A validação de horário atual mistura helpers de timezone com `new Date().getHours()` em alguns pontos. Antes de mexer em agenda, revise cuidadosamente efeitos de fuso.
- `supabase.zip` e `dist/` estão presentes no repositório local; não devem ser usados como fonte primária para entender o código de produção.

## O que uma IA precisa saber antes de mexer neste projeto

- Este é o projeto da barbearia, portanto a documentação correta é `docs/manager-context.md`.
- Não confundir com o app público do cliente final. Aqui o foco é gestão operacional da barbearia.
- Leia `src/routes/app-routes.tsx`, `src/routes/protected-route.tsx`, `src/hooks/use-barber-shop-data.ts` e `src/store/barbershop.store.ts` antes de alterar qualquer fluxo autenticado.
- Qualquer mudança em agenda deve respeitar `src/utils/date-time.ts` e o fuso `America/Sao_Paulo`.
- Qualquer mudança em agendamento precisa considerar cliente autenticado versus cliente manual.
- Qualquer mudança em serviços/profissionais precisa considerar a tabela de vínculo `barber_services` usada pelo frontend.
- Qualquer mudança em permissões precisa considerar `memberRole`: `owner`, `admin` e `reader`.
- Não usar apenas os SQL de `src/database` como fonte da verdade sem comparar com `supabase/README.md` e com o Supabase real.
- Operações privilegiadas de membros passam por Edge Functions, não por alteração direta do frontend com anon key.
- A estrutura do frontend separa páginas em `src/pages`, telas compostas em `src/components/main`, componentes reutilizáveis em `src/components/common`, modais em `src/components/modals`, hooks em `src/hooks` e chamadas reutilizáveis ao Supabase em `src/lib/supabase`.
- Evite refatorações amplas: o projeto tem regras de negócio sensíveis em agenda, timezone, RLS e membros.
- Antes de finalizar qualquer alteração futura, rode pelo menos `npm run build` e, quando aplicável, teste manualmente login, agenda e criação de agendamento.
