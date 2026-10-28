-- _BS_SUPABASE_V1 (28-oct-2026) — Tabla de la copia rápida de Bienestar.
-- Pegar en Supabase -> SQL Editor -> Run. Google Sheets sigue siendo la base oficial.
create table if not exists public.bs_registros (
  modulo      text        not null,
  id          text        not null,
  datos       jsonb       not null,
  actualizado timestamptz not null default now(),
  primary key (modulo, id)
);

alter table public.bs_registros enable row level security;

-- Nadie escribe desde el navegador: solo el servidor de Google con la llave secreta.
revoke all on public.bs_registros from anon;
revoke insert, update, delete, truncate on public.bs_registros from authenticated;
grant select on public.bs_registros to authenticated;

-- Cada usuario solo lee los módulos que su pase permite (lo firma el servidor de Google).
drop policy if exists bs_leer_por_modulo on public.bs_registros;
create policy bs_leer_por_modulo on public.bs_registros
  for select to authenticated
  using ( coalesce((auth.jwt() -> 'bs_mods') ? modulo, false) );
