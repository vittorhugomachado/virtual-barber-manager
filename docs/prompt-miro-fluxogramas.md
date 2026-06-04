# Prompt para o Miro AI — Fluxogramas das rotas ativas (Virtual Barber Manager)

> Cole o conteúdo do bloco abaixo no Miro AI ("Create with AI" → Diagram / Flowchart).
> Ele gera **um único board** com os 4 fluxos lado a lado, cada um em sua raia, bem separados visualmente.

---

## PROMPT (copie a partir daqui)

Crie um **fluxograma único** em um board, organizado em **4 colunas/raias verticais** separadas, uma para cada fluxo. Use português do Brasil. Padronize as formas assim:

- **Oval / Terminator** = início ou fim do fluxo
- **Retângulo** = ação ou tela
- **Losango (decisão)** = pergunta com saídas "Sim/Não"
- **Paralelogramo** = entrada de dados do usuário ou chamada de API/Supabase
- **Seta tracejada** = redirecionamento de rota (navigate)

Use cores por raia: Cadastro = azul, Login = verde, Confirmar Email = laranja, Cadastro Pendente = roxo. Coloque um título grande no topo de cada raia.

---

### RAIA 1 — CADASTRO  (rota: `/cadastro`)

1. Início: usuário acessa `/cadastro`
2. Decisão: "Status === authenticated?"
   - Sim → (seta tracejada) redireciona para `/painel` → Fim
   - Não → segue
3. Ação: exibe formulário de cadastro (nome da barbearia, nome do proprietário, celular, email, senha) + captcha Turnstile
4. Ação: usuário preenche e clica em "Criar conta"
5. Decisão: "Captcha validado (token presente)?"
   - Não → toast "Confirme que você não é um robô" → volta ao formulário
   - Sim → segue
6. Decisão: "Validação Zod ok? (nome, celular 11 dígitos, barbearia ≤30, email válido, senha ≥6)"
   - Não → mostra erros nos campos → volta ao formulário
   - Sim → segue
7. API (paralelogramo): `check_phone_exists` no Supabase
   - Decisão: "Celular já cadastrado?" → Sim → erro no campo celular → volta ao formulário
8. API (paralelogramo): `check_email_exists` no Supabase
   - Decisão: "Email já cadastrado?" → Sim → erro no campo email → volta ao formulário
9. API (paralelogramo): `supabase.auth.signUp` (envia metadados: role=barbershop, nome, telefone, nome da barbearia, signup_change_token; emailRedirectTo = `/confirmar-email`)
   - Decisão: "Houve erro de auth?"
     - Sim → reseta captcha + toast com mensagem traduzida ("Este email já está cadastrado" / "Muitas tentativas, aguarde") → volta ao formulário
     - Não → segue
   - Decisão: "Retornou user?"
     - Não → toast "Erro ao criar conta" → volta ao formulário
     - Sim → segue
10. Ação: toast "Conta criada com sucesso!"
11. Ação: salva `pending-signup` (email, userId, changeToken) no sessionStorage
12. (seta tracejada) redireciona para `/entrar` (passando o state do pending-signup)
13. Fim

---

### RAIA 2 — LOGIN  (rota: `/entrar`)

1. Início: usuário acessa `/entrar`
2. Decisão: "Status === authenticated?"
   - Sim → (seta tracejada) redireciona para `/painel` → Fim
   - Não → segue
3. Ação: exibe tela de login com **toggle de modo**: Proprietário | Colaborador + captcha Turnstile
4. Decisão: "Qual modo selecionado?"

   **RAMO A — PROPRIETÁRIO**
   - Ação: preenche email + senha, clica "Entrar"
   - Decisão: "Captcha válido?" → Não → toast "Confirme que você não é um robô" → volta
   - API: `supabase.auth.signInWithPassword(email, senha, captcha)`
   - Decisão: "Houve erro?"
     - Não → (seta tracejada) `/painel` → Fim
     - Sim → Decisão: "Erro === 'Email not confirmed'?"
       - Sim → salva `pending-signup` no sessionStorage + (seta tracejada) redireciona para `/cadastro-pendente/:email` → vai para RAIA 4
       - Não → reseta captcha + toast traduzido ("Usuário ou senha incorretos" / "Muitas tentativas") → volta

   **RAMO B — COLABORADOR**
   - Ação: preenche site da barbearia (slug), nome de usuário, senha, clica "Entrar"
   - Decisão: "Captcha válido?" → Não → toast → volta
   - API: `get_member_auth_email(username, slug)` no Supabase
   - Decisão: "Houve erro na busca?" → Sim → toast "Erro ao verificar usuário" → volta
   - Decisão: "Email interno encontrado?"
     - Não → erro no campo slug "Barbearia não encontrada ou usuário não pertence a ela" → volta
     - Sim → segue
   - API: `supabase.auth.signInWithPassword(emailInterno, senha, captcha)`
   - Decisão: "Houve erro?"
     - Não → (seta tracejada) `/painel` → Fim
     - Sim → reseta captcha + erro no campo senha "Senha incorreta" → volta

---

### RAIA 3 — CONFIRMAR EMAIL  (rota: `/confirmar-email`)

1. Início: usuário chega via link do email de confirmação em `/confirmar-email`
2. API: `supabase.auth.getSession()` (verifica sessão criada pelo link)
3. Decisão: "Sessão válida? (sem erro e session existe)"
   - Sim (status = success) → mostra Spinner → (seta tracejada) redireciona para `/painel` → Fim
   - Não (status = error) → segue (link expirado/usado)
4. Ação: exibe tela "Link expirado ou já usado" com campo de email
5. Ação: usuário digita email e clica "Solicitar novo link"
6. Decisão: "Email preenchido?" → Não → toast "Informe seu email" → volta
7. API: `check_user_confirmation_status(email)` no Supabase
   - Decisão: "Houve erro?" → Sim → toast "Erro ao verificar email" → volta
   - Decisão: "Usuário existe?" → Não → estado "not_found", mostra "Este email não está cadastrado" → volta
   - Decisão: "Já confirmado?" → Sim → estado "already_confirmed", tela "Email já confirmado" + botão "Entrar" → (seta tracejada) `/entrar`
   - Não confirmado → segue
8. API: `supabase.auth.resend(type=signup, email, emailRedirectTo=/confirmar-email)`
   - Decisão: "Houve erro?"
     - Sim → trata: "security purposes" → "Aguarde N segundos"; "captcha" → "Erro de verificação de segurança, recarregue"; outro → toast genérico → volta
     - Não → estado "sent", tela "Email enviado — verifique sua caixa de entrada" → Fim
9. Links auxiliares na tela: "Entrar" → `/entrar` | "Criar conta" → `/cadastro`

---

### RAIA 4 — CADASTRO PENDENTE  (rota: `/cadastro-pendente/:email`)

1. Início: chega em `/cadastro-pendente/:email` (vindo do login quando email não confirmado)
2. Decisão: "Status === authenticated?"
   - Sim → (seta tracejada) `/painel` → Fim
   - Não → segue
3. Decisão: "Existe email na URL?"
   - Não → (seta tracejada) redireciona para `/entrar` → Fim
   - Sim → segue
4. Ação: exibe tela "Confirme seu email" mostrando o email + aviso para checar spam + captcha invisível
5. Decisão: usuário escolhe uma ação (3 botões)

   **AÇÃO A — "Reenviar email de confirmação"**
   - Decisão: "Está em cooldown ou já reenviando?" → Sim → botão desabilitado (mostra "Reenviar em Ns")
   - API: `supabase.auth.resend(type=signup, email, captcha, emailRedirectTo=/confirmar-email)`
   - Decisão: "Houve erro?"
     - "security purposes" → ativa cooldown de N segundos + toast "Aguarde Ns para reenviar"
     - "captcha" → toast "Falha na verificação de segurança, recarregue"
     - outro → toast "Erro ao reenviar email"
     - Sem erro → cooldown de 60s + toast "Email reenviado!" → volta à tela

   **AÇÃO B — "Já confirmei meu email"**
   - API: `check_user_confirmation_status(email)` no Supabase
   - Decisão: "Houve erro?" → Sim → toast "Erro ao verificar status" → volta
   - Decisão: "is_confirmed === true?"
     - Sim → toast "Email confirmado! Faça login" → (seta tracejada) `/entrar` → Fim
     - Não → toast "Email ainda não confirmado, confira spam" → volta à tela

   **AÇÃO C — "Voltar para o login"**
   - (seta tracejada) `/entrar` → Fim

---

### Observações para o diagrama
- Mostre claramente as **conexões entre raias**: o Cadastro termina indo para o Login; o Login (proprietário, email não confirmado) leva ao Cadastro Pendente; tanto Confirmar Email quanto Cadastro Pendente, ao confirmar/sucesso, retornam para Login ou `/painel`.
- As raias de **Cadastro** e **Login** usam captcha **Cloudflare Turnstile** (visível) antes das chamadas de auth — destaque com um ícone de escudo nessas etapas. A raia **Confirmar Email** NÃO tem captcha no fluxo.
- `/painel` é hoje uma rota provisória de diagnóstico (não há rota protegida ativa ainda).

## (fim do prompt)
