-- A agenda administrativa lê e escreve por RPCs SECURITY DEFINER. A tabela
-- permanece consultável por usuários autenticados sob RLS para compatibilidade,
-- mas nenhuma role de navegador deve possuir privilégios diretos de escrita ou
-- manutenção (incluindo TRUNCATE, que não é protegido por RLS).

REVOKE ALL PRIVILEGES ON TABLE public.appointments FROM anon, authenticated;
GRANT SELECT ON TABLE public.appointments TO authenticated;
