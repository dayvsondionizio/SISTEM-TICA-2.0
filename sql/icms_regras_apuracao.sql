-- Regras da "Fazer Apuração": uma linha por cliente.
-- Tabela NOVA e separada: não altera icms_auditorias, icms_rascunhos nem icms_clientes.
-- Pode rodar mais de uma vez sem problema (if not exists / drop policy if exists).

create table if not exists public.icms_regras_apuracao (
  cliente_id      text primary key,                 -- mesmo id de icms_clientes
  regras          jsonb not null default '{}'::jsonb, -- um registro por produto do fornecedor, com o histórico mês a mês
  meses           text[] not null default '{}',     -- meses já apurados (MM/AAAA)
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text                              -- e-mail de quem finalizou
);

alter table public.icms_regras_apuracao enable row level security;

-- Só usuários logados no app leem e gravam. Não há política de exclusão: ninguém apaga regras pelo app.
drop policy if exists "regras_select_autenticados" on public.icms_regras_apuracao;
create policy "regras_select_autenticados" on public.icms_regras_apuracao
  for select to authenticated using (true);

drop policy if exists "regras_insert_autenticados" on public.icms_regras_apuracao;
create policy "regras_insert_autenticados" on public.icms_regras_apuracao
  for insert to authenticated with check (true);

drop policy if exists "regras_update_autenticados" on public.icms_regras_apuracao;
create policy "regras_update_autenticados" on public.icms_regras_apuracao
  for update to authenticated using (true) with check (true);
