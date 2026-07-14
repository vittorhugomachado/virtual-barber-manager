# Gerenciamento de membros

As operações de criação, atualização e exclusão passam pelas Edge
Functions porque elas precisam usar a Admin API do Supabase Auth. A
`SUPABASE_SERVICE_ROLE_KEY` nunca deve ser enviada ao frontend.

## Ordem de publicação

1. Execute `supabase/members-rpc.sql` no SQL Editor.
2. Publique as funções:

   ```sh
   supabase functions deploy create-member --no-verify-jwt
   supabase functions deploy update-member --no-verify-jwt
   supabase functions deploy delete-member --no-verify-jwt
   ```

   `--no-verify-jwt` permite que o preflight `OPTIONS` do navegador alcance a
   função. Os requests `POST` continuam protegidos: cada função exige o Bearer
   token e o valida com `auth.getUser` antes de acessar qualquer dado.

3. Configure os secrets opcionais:

   ```sh
   supabase secrets set MAX_MEMBERS_PER_BARBERSHOP=10
   supabase secrets set ALLOWED_ORIGINS=http://localhost:5173,https://seu-dominio.com
   ```

   Mais de uma origem pode ser informada separando os valores por vírgula.

## Criacao manual no Dashboard

Cada `index.ts` e autocontido e pode ser colado diretamente no editor manual do
Dashboard. Nao e necessario criar uma pasta `_shared`.

Nunca copie a `SUPABASE_SERVICE_ROLE_KEY` para o codigo. O Supabase fornece essa
variavel automaticamente no ambiente da Edge Function.

## Contrato

- `create-member`: `username`, `password`, `role`, `barbershop_id`.
- `update-member`: `member_id` e ao menos um de `username`, `password`, `role`.
- `delete-member`: `member_id`.

Em atualização e exclusão, `member_id` é sempre o campo `id` da tabela
`barbershop_members`, nunca o `user_id` do Auth.

As funções validam novamente o JWT e confirmam no banco que o chamador é o
proprietário. As RPCs auxiliares têm permissão apenas para `service_role`.
