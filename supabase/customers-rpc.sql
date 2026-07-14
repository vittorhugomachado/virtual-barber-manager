-- RPCs da área de clientes.
-- Este arquivo NÃO é executado pelo frontend: execute-o manualmente no SQL Editor do Supabase.
-- Todas as funções usam SECURITY DEFINER, mas validam auth.uid() e o acesso à barbearia internamente.
-- Leitura: owner ou qualquer membro. Escrita: owner, admin ou writer.
-- Os limites recebidos do navegador são restringidos novamente no banco para impedir consultas excessivas.

CREATE OR REPLACE FUNCTION public.get_customers(
  p_barbershop_id uuid,             -- Barbearia cuja lista será consultada.
  p_search text DEFAULT NULL,       -- Texto opcional para buscar por nome ou telefone.
  p_page integer DEFAULT 1,         -- Página solicitada; começa em 1.
  p_page_size integer DEFAULT 20    -- Quantidade solicitada por página; será limitada a 100.
)
RETURNS jsonb                       -- Retorna itens, total e metadados de paginação em JSON.
LANGUAGE plpgsql                    -- Permite variáveis, validações e múltiplas consultas.
SECURITY DEFINER                    -- Executa com os privilégios do dono da função.
SET search_path = ''                -- Evita sequestro de objetos por um search_path malicioso.
AS $function$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1); -- Impede página nula, zero ou negativa.
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100); -- Mantém o tamanho entre 1 e 100.
  v_search text := NULLIF(BTRIM(COALESCE(p_search, '')), ''); -- Remove espaços e converte busca vazia em NULL.
  v_search_phone text;              -- Guardará somente os dígitos pesquisados.
  v_search_pattern text;            -- Padrão textual com curingas do usuário escapados.
  v_total integer := 0;             -- Total de clientes após busca e deduplicação.
  v_items jsonb := '[]'::jsonb;     -- Lista da página atual; começa vazia.
BEGIN
  IF auth.uid() IS NULL THEN         -- Confirma que existe uma sessão Supabase válida.
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; -- Interrompe usuários anônimos.
  END IF;

  IF NOT EXISTS (                    -- Exige vínculo do usuário com a barbearia informada.
    SELECT 1                         -- Basta saber se um registro autorizado existe.
    FROM public.barbershops b        -- Consulta a barbearia real, sem confiar no frontend.
    WHERE b.id = p_barbershop_id     -- Restringe a validação ao ID recebido.
      AND (
        b.owner_id = auth.uid()      -- O proprietário sempre pode ler.
        OR EXISTS (                  -- Caso não seja owner, procura uma associação de membro.
          SELECT 1
          FROM public.barbershop_members bm -- Tabela que liga usuários às barbearias.
          WHERE bm.barbershop_id = b.id     -- A associação deve ser desta barbearia.
            AND bm.user_id = auth.uid()     -- E deve pertencer ao usuário autenticado.
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; -- Recusa acesso cruzado entre barbearias.
  END IF;

  v_search_phone := NULLIF(regexp_replace(COALESCE(v_search, ''), '[^0-9]', '', 'g'), ''); -- Normaliza a busca telefônica.
  v_search_pattern := CASE
    WHEN v_search IS NULL THEN NULL
    ELSE '%' || replace(replace(replace(v_search, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%'
  END;                               -- Faz % e _ digitados pelo usuário valerem como texto, não como curingas.

  WITH manual_customers AS (         -- Primeiro conjunto: clientes manuais desta barbearia.
    SELECT
      c.id,                           -- Identificador do cliente.
      c.barbershop_id,                -- Barbearia dona do cadastro manual.
      c.name,                         -- Nome persistido no banco.
      c.phone,                        -- Telefone persistido já normalizado.
      c.created_at,                   -- Data de criação usada na ordenação.
      c.updated_at,                   -- Data da última atualização.
      c.auth,                         -- Indica se o registro tem autenticação própria.
      c.auth_user_id,                 -- Usuário autenticado associado, quando existir.
      'customers'::text AS source,    -- Padroniza a origem consumida pela UI.
      COUNT(a.id) FILTER (
        WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      )::integer AS total_appointments, -- Conta agendamentos não cancelados no próprio SQL.
      MAX(a.starts_at) FILTER (
        WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      ) AS last_appointment           -- Localiza o agendamento mais recente não cancelado.
    FROM public.customers c           -- Parte da tabela canônica de clientes.
    LEFT JOIN public.appointments a   -- Mantém clientes que ainda não possuem agendamentos.
      ON a.barbershop_id = p_barbershop_id -- Impede contabilizar agendamentos de outra barbearia.
     AND a.manual_customer_id = c.id  -- Usa o vínculo destinado ao cliente manual.
    WHERE c.barbershop_id = p_barbershop_id -- Retorna somente cadastros desta barbearia.
      AND NOT COALESCE(c.auth, false) -- Exclui autenticados deste primeiro conjunto.
    GROUP BY c.id                     -- Produz uma linha agregada por cliente.
  ),
  authenticated_customers AS (       -- Segundo conjunto: clientes autenticados que agendaram aqui.
    SELECT
      c.id,                           -- ID global do cliente autenticado.
      p_barbershop_id AS barbershop_id, -- Projeta a barbearia consultada para o contrato da UI.
      COALESCE(NULLIF(BTRIM(c.name), ''), 'Cliente sem nome') AS name, -- Garante nome exibível.
      c.phone,                        -- Telefone verificado do cliente autenticado.
      MIN(COALESCE(a.created_at, c.created_at)) AS created_at, -- Primeira aparição nesta barbearia.
      c.updated_at,                   -- Última atualização do cadastro.
      c.auth,                         -- Mantém a informação de autenticação.
      c.auth_user_id,                 -- Mantém o usuário correspondente.
      'customers_auth'::text AS source, -- Origem padronizada para a UI.
      COUNT(a.id) FILTER (
        WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      )::integer AS total_appointments, -- Conta visitas não canceladas nesta barbearia.
      MAX(a.starts_at) FILTER (
        WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      ) AS last_appointment           -- Obtém a visita mais recente não cancelada.
    FROM public.appointments a        -- O vínculo com a barbearia nasce do agendamento.
    JOIN public.customers c           -- Recupera os dados atuais do cliente autenticado.
      ON c.id = a.customer_id         -- Usa o vínculo de cliente autenticado.
     AND COALESCE(c.auth, false)      -- Confirma que ele realmente é autenticado.
    WHERE a.barbershop_id = p_barbershop_id -- Restringe os agendamentos à barbearia consultada.
      AND a.customer_id IS NOT NULL   -- Ignora agendamentos sem cliente autenticado.
    GROUP BY c.id                     -- Gera uma linha por cliente autenticado.
  ),
  merged AS (                         -- Une os dois formatos em um contrato único.
    SELECT * FROM manual_customers    -- Inclui todos os clientes manuais.
    UNION ALL                         -- Evita custo de deduplicação aqui; ela será controlada abaixo.
    SELECT * FROM authenticated_customers -- Inclui clientes autenticados com histórico na loja.
  ),
  ranked AS (                         -- Agrupa identidades pelo telefone normalizado.
    SELECT
      m.*,
      SUM(m.total_appointments) OVER (PARTITION BY
        COALESCE(
          NULLIF(regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g'), ''),
          'id:' || m.id::text
        )
      )::integer AS combined_total_appointments, -- Soma o histórico manual e autenticado duplicado.
      MAX(m.last_appointment) OVER (PARTITION BY
        COALESCE(
          NULLIF(regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g'), ''),
          'id:' || m.id::text
        )
      ) AS combined_last_appointment, -- Mantém a data mais recente entre as possíveis duplicatas.
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(
          NULLIF(regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g'), ''),
          'id:' || m.id::text
        )
        ORDER BY CASE WHEN m.source = 'customers_auth' THEN 0 ELSE 1 END,
                 m.created_at DESC,
                 m.id DESC
      ) AS identity_rank              -- Marca como 1 o registro canônico que será exibido.
    FROM merged m                     -- Aplica as janelas sobre as duas origens já unificadas.
  ),
  deduplicated AS (                   -- Remove duplicidade manual/autenticada do resultado visual.
    SELECT
      id, barbershop_id, name, phone, created_at, updated_at, auth,
      auth_user_id, source,
      combined_total_appointments AS total_appointments,
      combined_last_appointment AS last_appointment
    FROM ranked                       -- Usa os resultados calculados pela etapa anterior.
    WHERE identity_rank = 1           -- Mantém apenas uma identidade; autenticado tem prioridade.
  ),
  filtered AS (                       -- Aplica busca antes de contar e paginar.
    SELECT *
    FROM deduplicated m
    WHERE v_search IS NULL            -- Sem texto, todos os clientes permanecem elegíveis.
       OR m.name ILIKE v_search_pattern ESCAPE E'\\' -- Busca nome literalmente, sem diferenciar maiúsculas/minúsculas.
       OR (v_search_phone IS NOT NULL AND COALESCE(m.phone, '') LIKE '%' || v_search_phone || '%') -- Busca dígitos do telefone.
  ),
  counted AS (                        -- Calcula o total sem uma consulta separada na página válida.
    SELECT f.*, COUNT(*) OVER ()::integer AS full_count -- Repete o total em cada linha paginada.
    FROM filtered f                   -- Conta somente os resultados da busca atual.
  ),
  paged AS (                          -- Recorta somente os registros solicitados pelo navegador.
    SELECT *
    FROM counted
    ORDER BY created_at DESC, id DESC -- Ordenação estável: mais novos primeiro e ID como desempate.
    LIMIT v_page_size                 -- Nunca envia mais que o tamanho validado da página.
    OFFSET (v_page - 1) * v_page_size -- Pula exatamente as páginas anteriores.
  )
  SELECT
    COALESCE(MAX(full_count), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'barbershop_id', barbershop_id,
          'name', name,
          'phone', phone,
          'created_at', created_at,
          'updated_at', updated_at,
          'auth', auth,
          'auth_user_id', auth_user_id,
          'source', source,
          'total_appointments', total_appointments,
          'last_appointment', last_appointment
        )
        ORDER BY created_at DESC, id DESC
      ),
      '[]'::jsonb
    )
  INTO v_total, v_items               -- Salva a contagem e a lista nas variáveis de retorno.
  FROM paged;                         -- Agrega exclusivamente a página atual.

  -- An empty page has no window row from which to read the total.
  IF v_total = 0 AND v_page > 1 THEN  -- Trata página além do fim, onde a janela não possui linhas.
    WITH manual_ids AS (
      SELECT c.id, c.name, c.phone
      FROM public.customers c
      WHERE c.barbershop_id = p_barbershop_id
        AND NOT COALESCE(c.auth, false)
    ),
    auth_ids AS (
      SELECT DISTINCT c.id, COALESCE(NULLIF(BTRIM(c.name), ''), 'Cliente sem nome') AS name, c.phone
      FROM public.appointments a
      JOIN public.customers c ON c.id = a.customer_id AND COALESCE(c.auth, false)
      WHERE a.barbershop_id = p_barbershop_id
    ),
    all_ids AS (
      SELECT *, COALESCE(
        NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), ''),
        'id:' || id::text
      ) AS identity_key FROM manual_ids
      UNION ALL
      SELECT *, COALESCE(
        NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), ''),
        'id:' || id::text
      ) AS identity_key FROM auth_ids
    )
    SELECT COUNT(DISTINCT identity_key)::integer -- Recalcula apenas o total deduplicado.
    INTO v_total                      -- Preserva total_pages mesmo quando a página está vazia.
    FROM all_ids m
    WHERE v_search IS NULL
       OR m.name ILIKE v_search_pattern ESCAPE E'\\'
       OR (v_search_phone IS NOT NULL AND COALESCE(m.phone, '') LIKE '%' || v_search_phone || '%');
  END IF;

  RETURN jsonb_build_object(          -- Monta o contrato final consumido pelo hook React.
    'items', v_items,                 -- Clientes da página atual.
    'total', v_total,                 -- Quantidade total encontrada no banco.
    'page', v_page,                   -- Página efetivamente utilizada.
    'page_size', v_page_size,         -- Limite efetivamente aplicado.
    'total_pages', CASE WHEN v_total = 0 THEN 0 ELSE CEIL(v_total::numeric / v_page_size)::integer END -- Número navegável de páginas.
  );
END;                                  -- Finaliza a lógica de get_customers.
$function$;                           -- Finaliza e instala a função no PostgreSQL.


CREATE OR REPLACE FUNCTION public.create_customer(
  p_barbershop_id uuid,               -- Barbearia que será dona do novo cadastro.
  p_name text,                        -- Nome ainda não confiável recebido do consumidor.
  p_phone text                        -- Telefone ainda não confiável, mascarado ou não.
)
RETURNS jsonb                         -- Retorna created, conflict, invalid ou erro do Supabase.
LANGUAGE plpgsql                      -- Permite validar, consultar conflito e inserir atomicamente.
SECURITY DEFINER                      -- Contorna RLS somente após as validações explícitas abaixo.
SET search_path = ''                  -- Obriga referências qualificadas e protege a função.
AS $function$
DECLARE
  v_name text := NULLIF(BTRIM(COALESCE(p_name, '')), ''); -- Limpa o nome e transforma vazio em NULL.
  v_phone text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'); -- Persiste somente dígitos.
  v_customer public.customers%ROWTYPE; -- Receberá exatamente a linha inserida no banco.
  v_conflict jsonb;                  -- Receberá um cliente que já usa o telefone.
BEGIN
  IF auth.uid() IS NULL THEN          -- Não aceita criação sem sessão autenticada.
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; -- Retorna erro de autenticação padrão.
  END IF;

  IF NOT EXISTS (                     -- Confere permissão de escrita na barbearia.
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND (
        b.owner_id = auth.uid()       -- O proprietário pode criar clientes.
        OR EXISTS (
          SELECT 1 FROM public.barbershop_members bm
          WHERE bm.barbershop_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.role::text IN ('admin', 'writer') -- Reader pode consultar, mas não alterar.
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; -- Bloqueia escrita sem papel autorizado.
  END IF;

  IF v_name IS NULL THEN              -- Nome é obrigatório depois da limpeza.
    RETURN jsonb_build_object('status', 'invalid', 'field', 'name'); -- Permite mensagem específica na UI.
  END IF;
  IF length(v_phone) NOT IN (10, 11) THEN -- Aceita telefone brasileiro fixo ou celular com DDD.
    RETURN jsonb_build_object('status', 'invalid', 'field', 'phone'); -- Impede telefone inválido no banco.
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_barbershop_id::text || ':' || v_phone, 0)
  );                                  -- Serializa create/update concorrentes para o mesmo telefone nesta barbearia.

  SELECT candidate.payload            -- Escolhe o cadastro conflitante mais apropriado.
  INTO v_conflict                     -- Salva o JSON para retorno imediato.
  FROM (                              -- Une possíveis conflitos manuais e autenticados.
    SELECT
      2 AS priority,                  -- Manual fica abaixo do autenticado na escolha canônica.
      c.created_at AS sort_date,
      jsonb_build_object(
        'id', c.id, 'barbershop_id', c.barbershop_id, 'name', c.name,
        'phone', c.phone, 'created_at', c.created_at, 'updated_at', c.updated_at,
        'auth', c.auth, 'auth_user_id', c.auth_user_id, 'source', 'customers',
        'total_appointments', 0, 'last_appointment', NULL
      ) AS payload
    FROM public.customers c           -- Procura cadastro manual na própria barbearia.
    WHERE c.barbershop_id = p_barbershop_id
      AND NOT COALESCE(c.auth, false)
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone -- Compara telefones normalizados.

    UNION ALL                         -- Também procura o mesmo telefone entre autenticados.

    SELECT
      1,                              -- Autenticado tem prioridade para evitar duplicação visual.
      MIN(COALESCE(a.created_at, c.created_at)),
      jsonb_build_object(
        'id', c.id, 'barbershop_id', p_barbershop_id, 'name', COALESCE(NULLIF(BTRIM(c.name), ''), 'Cliente sem nome'),
        'phone', c.phone, 'created_at', MIN(COALESCE(a.created_at, c.created_at)), 'updated_at', c.updated_at,
        'auth', c.auth, 'auth_user_id', c.auth_user_id, 'source', 'customers_auth',
        'total_appointments', COUNT(a.id)::integer, 'last_appointment', MAX(a.starts_at)
      )
    FROM public.appointments a        -- O agendamento prova o vínculo do autenticado com a loja.
    JOIN public.customers c ON c.id = a.customer_id AND COALESCE(c.auth, false)
    WHERE a.barbershop_id = p_barbershop_id
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone
    GROUP BY c.id                     -- Consolida estatísticas do cliente autenticado.
  ) candidate
  ORDER BY candidate.priority, candidate.sort_date DESC -- Prioriza autenticado e depois o mais recente.
  LIMIT 1;                            -- Um conflito é suficiente para impedir a inserção.

  IF v_conflict IS NOT NULL THEN      -- Não cria uma segunda identidade com o mesmo telefone.
    RETURN jsonb_build_object('status', 'conflict', 'existing', v_conflict); -- Entrega o existente à UI.
  END IF;

  BEGIN                               -- Sub-bloco captura corrida de concorrência no insert.
    INSERT INTO public.customers (barbershop_id, name, phone) -- Insere somente campos permitidos.
    VALUES (p_barbershop_id, v_name, v_phone) -- Usa dados já validados e normalizados.
    RETURNING * INTO v_customer;      -- Obtém a fonte oficial criada pelo banco.
  EXCEPTION WHEN unique_violation THEN -- Outra requisição pode ter inserido o telefone simultaneamente.
    SELECT jsonb_build_object(
      'id', c.id, 'barbershop_id', c.barbershop_id, 'name', c.name,
      'phone', c.phone, 'created_at', c.created_at, 'updated_at', c.updated_at,
      'auth', c.auth, 'auth_user_id', c.auth_user_id, 'source', 'customers',
      'total_appointments', 0, 'last_appointment', NULL
    )
    INTO v_conflict
    FROM public.customers c
    WHERE c.barbershop_id = p_barbershop_id
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone
    LIMIT 1;

    IF v_conflict IS NOT NULL THEN    -- Converte violação esperada em resultado de negócio.
      RETURN jsonb_build_object('status', 'conflict', 'existing', v_conflict); -- Evita expor erro técnico.
    END IF;
    RAISE;                            -- Repropaga violações únicas que não sejam de telefone.
  END;

  RETURN jsonb_build_object(          -- Retorna a linha real, nunca uma cópia criada pelo frontend.
    'status', 'created',              -- Informa que a transação concluiu a criação.
    'customer', jsonb_build_object(
      'id', v_customer.id, 'barbershop_id', v_customer.barbershop_id,
      'name', v_customer.name, 'phone', v_customer.phone,
      'created_at', v_customer.created_at, 'updated_at', v_customer.updated_at,
      'auth', v_customer.auth, 'auth_user_id', v_customer.auth_user_id,
      'source', 'customers', 'total_appointments', 0, 'last_appointment', NULL -- Novo manual ainda não tem histórico.
    )
  );
END;                                  -- Finaliza create_customer.
$function$;                           -- Instala a função de criação.


CREATE OR REPLACE FUNCTION public.update_customer(
  p_barbershop_id uuid,               -- Barbearia que deve ser dona do cliente.
  p_customer_id uuid,                 -- Cliente manual que será atualizado.
  p_name text,                        -- Novo nome recebido.
  p_phone text                        -- Novo telefone recebido.
)
RETURNS jsonb                         -- Retorna o cliente atualizado ou o conflito encontrado.
LANGUAGE plpgsql                      -- Permite executar validação e update em uma transação.
SECURITY DEFINER                      -- A função controla o acesso em vez de confiar no navegador.
SET search_path = ''                  -- Protege resolução de tabelas e funções.
AS $function$
DECLARE
  v_name text := NULLIF(BTRIM(COALESCE(p_name, '')), ''); -- Sanitiza o nome.
  v_phone text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'); -- Normaliza o telefone.
  v_customer public.customers%ROWTYPE; -- Guarda a linha bloqueada e depois a atualizada.
  v_conflict jsonb;                  -- Guarda outro cliente com o mesmo telefone.
  v_total integer := 0;              -- Quantidade atual de agendamentos não cancelados.
  v_last timestamptz;                -- Data do último agendamento.
BEGIN
  IF auth.uid() IS NULL THEN          -- Exige sessão válida.
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; -- Interrompe usuário anônimo.
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.barbershop_members bm
          WHERE bm.barbershop_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.role::text IN ('admin', 'writer') -- Somente membros com escrita podem atualizar.
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_name IS NULL THEN              -- Recusa nome vazio.
    RETURN jsonb_build_object('status', 'invalid', 'field', 'name');
  END IF;
  IF length(v_phone) NOT IN (10, 11) THEN -- Recusa telefone fora do padrão brasileiro.
    RETURN jsonb_build_object('status', 'invalid', 'field', 'phone');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_barbershop_id::text || ':' || v_phone, 0)
  );                                  -- Impede dois updates/creates simultâneos de reservarem a mesma identidade.

  SELECT * INTO v_customer            -- Carrega a linha real que será alterada.
  FROM public.customers c             -- Consulta diretamente a tabela canônica.
  WHERE c.id = p_customer_id          -- Restringe ao cliente solicitado.
    AND c.barbershop_id = p_barbershop_id -- Garante que pertence à barbearia autorizada.
    AND NOT COALESCE(c.auth, false)    -- Impede editar autenticados por este fluxo.
  FOR UPDATE;                         -- Bloqueia a linha contra alterações concorrentes.

  IF NOT FOUND THEN                   -- Também cobre ID de outra barbearia sem revelar sua existência.
    RETURN jsonb_build_object('status', 'not_found'); -- Resposta segura e previsível.
  END IF;

  SELECT jsonb_build_object(
    'id', c.id, 'barbershop_id', c.barbershop_id, 'name', c.name,
    'phone', c.phone, 'created_at', c.created_at, 'updated_at', c.updated_at,
    'auth', c.auth, 'auth_user_id', c.auth_user_id, 'source', 'customers',
    'total_appointments', 0, 'last_appointment', NULL
  )
  INTO v_conflict
  FROM public.customers c
  WHERE c.barbershop_id = p_barbershop_id
    AND c.id <> p_customer_id
    AND NOT COALESCE(c.auth, false)
    AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_conflict IS NULL THEN          -- Só procura autenticado se não achou manual conflitante.
    SELECT jsonb_build_object(
      'id', c.id, 'barbershop_id', p_barbershop_id,
      'name', COALESCE(NULLIF(BTRIM(c.name), ''), 'Cliente sem nome'),
      'phone', c.phone, 'created_at', MIN(COALESCE(a.created_at, c.created_at)),
      'updated_at', c.updated_at, 'auth', c.auth, 'auth_user_id', c.auth_user_id,
      'source', 'customers_auth', 'total_appointments', COUNT(a.id)::integer,
      'last_appointment', MAX(a.starts_at)
    )
    INTO v_conflict
    FROM public.appointments a
    JOIN public.customers c ON c.id = a.customer_id AND COALESCE(c.auth, false)
    WHERE a.barbershop_id = p_barbershop_id
      AND c.id <> p_customer_id
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone
    GROUP BY c.id
    ORDER BY MIN(COALESCE(a.created_at, c.created_at)) DESC
    LIMIT 1;
  END IF;

  IF v_conflict IS NOT NULL THEN      -- Telefone já identifica outra pessoa.
    RETURN jsonb_build_object('status', 'conflict', 'existing', v_conflict); -- Não executa update inconsistente.
  END IF;

  BEGIN                               -- Protege contra conflito criado entre a consulta e o update.
    UPDATE public.customers           -- Atualiza a tabela canônica.
    SET name = v_name,                -- Persiste o nome sanitizado.
        phone = v_phone,              -- Persiste somente os dígitos.
        updated_at = now()            -- Deixa a data sob responsabilidade do banco.
    WHERE id = p_customer_id          -- Altera somente a linha previamente bloqueada.
    RETURNING * INTO v_customer;      -- Recupera a versão oficial atualizada.
  EXCEPTION WHEN unique_violation THEN -- Captura corrida de telefone duplicado.
    RETURN jsonb_build_object('status', 'conflict'); -- Informa conflito sem expor detalhes internos.
  END;

  SELECT
    COUNT(a.id) FILTER (
      WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
    )::integer,
    MAX(a.starts_at) FILTER (
      WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
    )
  INTO v_total, v_last
  FROM public.appointments a
  WHERE a.barbershop_id = p_barbershop_id
    AND a.manual_customer_id = p_customer_id;

  RETURN jsonb_build_object(          -- Entrega a versão final e suas estatísticas à UI.
    'status', 'updated',              -- Confirma que o update foi concluído.
    'customer', jsonb_build_object(
      'id', v_customer.id, 'barbershop_id', v_customer.barbershop_id,
      'name', v_customer.name, 'phone', v_customer.phone,
      'created_at', v_customer.created_at, 'updated_at', v_customer.updated_at,
      'auth', v_customer.auth, 'auth_user_id', v_customer.auth_user_id,
      'source', 'customers', 'total_appointments', v_total, 'last_appointment', v_last
    )
  );
END;                                  -- Finaliza update_customer.
$function$;                           -- Instala a função de atualização.


CREATE OR REPLACE FUNCTION public.delete_customer(
  p_barbershop_id uuid,               -- Barbearia que deve ser dona do cadastro.
  p_customer_id uuid                  -- Cliente manual solicitado para exclusão.
)
RETURNS jsonb                         -- Retorna deleted, conflict ou not_found.
LANGUAGE plpgsql                      -- Mantém checagem, desvinculação e delete na mesma transação.
SECURITY DEFINER                      -- Permite operação controlada mesmo com RLS ativo.
SET search_path = ''                  -- Evita resolução insegura de objetos.
AS $function$
DECLARE
  v_customer public.customers%ROWTYPE; -- Guarda e bloqueia o cliente que será removido.
  v_future_count integer := 0;        -- Quantidade de agendamentos futuros ainda ativos.
BEGIN
  IF auth.uid() IS NULL THEN          -- Exige autenticação antes de qualquer consulta.
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; -- Bloqueia anônimos.
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.barbershop_members bm
          WHERE bm.barbershop_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.role::text IN ('admin', 'writer') -- Reader não pode excluir.
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_customer            -- Busca o cliente dentro do escopo autorizado.
  FROM public.customers c             -- Usa a fonte canônica.
  WHERE c.id = p_customer_id          -- Restringe ao ID solicitado.
    AND c.barbershop_id = p_barbershop_id -- Evita exclusão cruzada entre lojas.
    AND NOT COALESCE(c.auth, false)    -- Autenticados não podem ser apagados por este fluxo.
  FOR UPDATE;                         -- Mantém a linha bloqueada até o final da transação.

  IF NOT FOUND THEN                   -- Cliente inexistente, externo ou autenticado resulta igual.
    RETURN jsonb_build_object('status', 'not_found'); -- Não vaza dados de outra barbearia.
  END IF;

  SELECT COUNT(*)::integer            -- Conta somente vínculos que realmente impedem o delete.
  INTO v_future_count                 -- Salva a contagem para informar o modal.
  FROM public.appointments a          -- Consulta os agendamentos na mesma transação.
  WHERE a.barbershop_id = p_barbershop_id -- Restringe à loja autorizada.
    AND (
      a.manual_customer_id = p_customer_id   -- Vínculo esperado para cliente manual.
      OR a.customer_id = p_customer_id       -- Proteção defensiva para vínculos legados inconsistentes.
    )
    AND a.starts_at >= now()          -- Considera apenas horários presentes ou futuros.
    AND a.status::text NOT IN (
      'completed', 'cancelled_by_customer', 'cancelled_by_barbershop', 'no_show'
    );                                -- Estados encerrados não bloqueiam exclusão.

  IF v_future_count > 0 THEN          -- Regra crítica fica no banco, não no modal.
    RETURN jsonb_build_object(        -- Retorna conflito sem modificar nenhum dado.
      'status', 'conflict',           -- Status tratado pela UI.
      'reason', 'future_appointments', -- Motivo estável e reutilizável por outros clientes.
      'future_appointments', v_future_count -- Quantidade exibível na mensagem.
    );
  END IF;

  -- A checagem, a preservação do snapshot e o delete executam na mesma transação e sob o mesmo bloqueio.
  UPDATE public.appointments          -- Preserva os snapshots dos agendamentos antigos.
  SET manual_customer_id = NULL       -- Remove somente a chave estrangeira do cadastro apagado.
  WHERE barbershop_id = p_barbershop_id -- Mantém o escopo da barbearia.
    AND manual_customer_id = p_customer_id; -- Desvincula apenas este cliente.

  DELETE FROM public.customers        -- Apaga o cadastro depois de liberar vínculos históricos.
  WHERE id = p_customer_id            -- Restringe ao cliente bloqueado.
    AND barbershop_id = p_barbershop_id; -- Reforça a proteção de escopo no próprio delete.

  RETURN jsonb_build_object('status', 'deleted', 'customer_id', p_customer_id); -- Confirma o ID removido.
END;                                  -- Se qualquer instrução falhar, PostgreSQL desfaz toda a função.
$function$;                           -- Instala a função de exclusão atômica.


CREATE OR REPLACE FUNCTION public.get_customer_history(
  p_barbershop_id uuid,               -- Barbearia onde o histórico será consultado.
  p_customer_id uuid,                 -- Cliente cuja agenda será carregada.
  p_source text,                      -- Origem obrigatória: customers ou customers_auth.
  p_page integer DEFAULT 1,           -- Página solicitada, começando em 1.
  p_page_size integer DEFAULT 10      -- Itens solicitados; o banco limita a 50.
)
RETURNS jsonb                         -- Retorna itens e metadados do histórico paginado.
LANGUAGE plpgsql                      -- Permite validação condicional conforme a origem.
SECURITY DEFINER                      -- Lê relações protegidas somente após autorizar a loja.
SET search_path = ''                  -- Protege a função contra objetos homônimos maliciosos.
AS $function$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1); -- Normaliza página inválida para 1.
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 10), 1), 50); -- Limita resposta entre 1 e 50.
  v_total integer := 0;               -- Total completo de agendamentos do cliente.
  v_last timestamptz;                 -- Data do agendamento mais recente.
  v_items jsonb := '[]'::jsonb;       -- Itens da página atual.
BEGIN
  IF auth.uid() IS NULL THEN          -- Exige sessão autenticada.
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; -- Bloqueia anônimo.
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.barbershop_members bm
          WHERE bm.barbershop_id = b.id AND bm.user_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_source NOT IN ('customers', 'customers_auth') THEN -- Impede coluna/origem arbitrária enviada pelo cliente.
    RETURN jsonb_build_object('status', 'invalid', 'field', 'source'); -- Retorna erro de contrato.
  END IF;

  IF p_source = 'customers' AND NOT EXISTS ( -- Para manual, exige cadastro pertencente à loja.
    SELECT 1 FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.barbershop_id = p_barbershop_id
      AND NOT COALESCE(c.auth, false)
  ) THEN
    RETURN jsonb_build_object('status', 'not_found'); -- Não revela clientes de outra loja.
  END IF;

  IF p_source = 'customers_auth' AND NOT EXISTS ( -- Para autenticado, exige agendamento nesta loja.
    SELECT 1
    FROM public.appointments a
    JOIN public.customers c ON c.id = a.customer_id AND COALESCE(c.auth, false)
    WHERE a.barbershop_id = p_barbershop_id
      AND a.customer_id = p_customer_id
  ) THEN
    RETURN jsonb_build_object('status', 'not_found'); -- Impede consultar histórico global do usuário.
  END IF;

  SELECT COUNT(*)::integer, MAX(a.starts_at) -- Calcula total e última data diretamente no banco.
  INTO v_total, v_last                -- Guarda estatísticas independentes da página.
  FROM public.appointments a          -- Consulta a tabela de agenda.
  WHERE a.barbershop_id = p_barbershop_id -- Mantém isolamento entre barbearias.
    AND (
      (p_source = 'customers' AND a.manual_customer_id = p_customer_id)
      OR (
        p_source = 'customers_auth'
        AND (
          a.customer_id = p_customer_id
          OR a.manual_customer_id IN ( -- Inclui histórico manual duplicado pelo mesmo telefone.
            SELECT manual_customer.id
            FROM public.customers manual_customer
            JOIN public.customers auth_customer ON auth_customer.id = p_customer_id
            WHERE manual_customer.barbershop_id = p_barbershop_id
              AND NOT COALESCE(manual_customer.auth, false)
              AND NULLIF(
                regexp_replace(COALESCE(manual_customer.phone, ''), '[^0-9]', '', 'g'),
                ''
              ) = NULLIF(
                regexp_replace(COALESCE(auth_customer.phone, ''), '[^0-9]', '', 'g'),
                ''
              )
          )
        )
      )
    );

  SELECT COALESCE(                    -- Agrega a página em um array JSON sempre válido.
    jsonb_agg(row_payload ORDER BY starts_at DESC, id DESC),
    '[]'::jsonb
  )
  INTO v_items                        -- Guarda os itens paginados para o retorno.
  FROM (                              -- Subconsulta monta cada agendamento já pronto para a UI.
    SELECT
      a.id,
      a.starts_at,
      jsonb_build_object(
        'id', a.id,                   -- Identificador do agendamento.
        'starts_at', a.starts_at,     -- Data/hora exibida no histórico.
        'status', a.status,           -- Estado usado pelo badge da UI.
        'service_name', COALESCE(a.service_name, s.name, 'Serviço removido'), -- Prioriza snapshot e cria fallback.
        'barber_name', COALESCE(a.barber_name, b.name) -- Prioriza snapshot e depois relação atual.
      ) AS row_payload
    FROM public.appointments a        -- Parte do registro histórico principal.
    LEFT JOIN public.services s       -- Serviço pode ter sido removido, por isso LEFT JOIN.
      ON s.id = a.service_id AND s.barbershop_id = a.barbershop_id -- Impede relação cruzada.
    LEFT JOIN public.barbers b        -- Profissional também pode ter sido removido.
      ON b.id = a.barber_id AND b.barbershop_id = a.barbershop_id -- Mantém escopo da loja.
    WHERE a.barbershop_id = p_barbershop_id -- Filtra a barbearia autorizada.
      AND (
        (p_source = 'customers' AND a.manual_customer_id = p_customer_id)
        OR (
          p_source = 'customers_auth'
          AND (
            a.customer_id = p_customer_id
            OR a.manual_customer_id IN (
              SELECT manual_customer.id
              FROM public.customers manual_customer
              JOIN public.customers auth_customer ON auth_customer.id = p_customer_id
              WHERE manual_customer.barbershop_id = p_barbershop_id
                AND NOT COALESCE(manual_customer.auth, false)
                AND NULLIF(
                  regexp_replace(COALESCE(manual_customer.phone, ''), '[^0-9]', '', 'g'),
                  ''
                ) = NULLIF(
                  regexp_replace(COALESCE(auth_customer.phone, ''), '[^0-9]', '', 'g'),
                  ''
                )
            )
          )
        )
      )
    ORDER BY a.starts_at DESC, a.id DESC -- Mostra mais recentes primeiro com desempate estável.
    LIMIT v_page_size                 -- Retorna somente 10 por padrão e no máximo 50.
    OFFSET (v_page - 1) * v_page_size -- Permite acessar todas as páginas do histórico.
  ) history_rows;

  RETURN jsonb_build_object(          -- Monta o contrato consumido pelo modal.
    'status', 'ok',                   -- Confirma uma consulta válida, inclusive quando vazia.
    'items', v_items,                 -- Agendamentos da página atual.
    'total', v_total,                 -- Total completo para o resumo.
    'last_appointment', v_last,       -- Última data independentemente da página aberta.
    'page', v_page,                   -- Página efetivamente usada.
    'page_size', v_page_size,         -- Quantidade máxima aplicada.
    'total_pages', CASE WHEN v_total = 0 THEN 0 ELSE CEIL(v_total::numeric / v_page_size)::integer END -- Páginas navegáveis.
  );
END;                                  -- Finaliza get_customer_history.
$function$;                           -- Instala a função de histórico.


-- Índices auxiliares para listagem, relacionamentos, histórico e verificação de agendamentos futuros.
CREATE INDEX IF NOT EXISTS idx_customers_barbershop_created_at
  ON public.customers (barbershop_id, created_at DESC); -- Acelera listagem ordenada por loja.

CREATE INDEX IF NOT EXISTS idx_customers_barbershop_phone
  ON public.customers (barbershop_id, phone); -- Acelera conflito e busca exata de telefone.

CREATE INDEX IF NOT EXISTS idx_customers_barbershop_phone_normalized
  ON public.customers (
    barbershop_id,
    (regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'))
  );                                  -- Acelera comparações normalizadas enquanto ainda existirem telefones legados mascarados.

DO $unique_phone_index$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.barbershop_id IS NOT NULL
      AND NOT COALESCE(c.auth, false)
      AND NULLIF(regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
    GROUP BY
      c.barbershop_id,
      regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g')
    HAVING COUNT(*) > 1
  ) THEN
    RAISE WARNING 'Índice único de telefone não criado: existem clientes manuais duplicados. Corrija-os e execute este arquivo novamente.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_manual_barbershop_phone_normalized
      ON public.customers (
        barbershop_id,
        (regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'))
      )
      WHERE barbershop_id IS NOT NULL
        AND NOT COALESCE(auth, false)
        AND NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), '') IS NOT NULL;
  END IF;
END;
$unique_phone_index$;                 -- Garante unicidade quando os dados atuais já estiverem consistentes.

CREATE INDEX IF NOT EXISTS idx_appointments_shop_manual_customer_starts
  ON public.appointments (barbershop_id, manual_customer_id, starts_at DESC)
  WHERE manual_customer_id IS NOT NULL; -- Índice parcial para histórico e delete de manuais.

CREATE INDEX IF NOT EXISTS idx_appointments_shop_auth_customer_starts
  ON public.appointments (barbershop_id, customer_id, starts_at DESC)
  WHERE customer_id IS NOT NULL;      -- Índice parcial para histórico autenticado.

REVOKE ALL ON FUNCTION public.get_customers(uuid, text, integer, integer) FROM PUBLIC; -- Remove execução pública implícita.
REVOKE ALL ON FUNCTION public.create_customer(uuid, text, text) FROM PUBLIC; -- Protege criação contra anon.
REVOKE ALL ON FUNCTION public.update_customer(uuid, uuid, text, text) FROM PUBLIC; -- Protege atualização contra anon.
REVOKE ALL ON FUNCTION public.delete_customer(uuid, uuid) FROM PUBLIC; -- Protege exclusão contra anon.
REVOKE ALL ON FUNCTION public.get_customer_history(uuid, uuid, text, integer, integer) FROM PUBLIC; -- Protege histórico.

GRANT EXECUTE ON FUNCTION public.get_customers(uuid, text, integer, integer) TO authenticated; -- Sessões autenticadas podem chamar; a função valida a loja.
GRANT EXECUTE ON FUNCTION public.create_customer(uuid, text, text) TO authenticated; -- A função ainda exige owner/admin/writer.
GRANT EXECUTE ON FUNCTION public.update_customer(uuid, uuid, text, text) TO authenticated; -- A função ainda valida propriedade.
GRANT EXECUTE ON FUNCTION public.delete_customer(uuid, uuid) TO authenticated; -- A função ainda bloqueia futuros.
GRANT EXECUTE ON FUNCTION public.get_customer_history(uuid, uuid, text, integer, integer) TO authenticated; -- A função ainda isola a loja.
