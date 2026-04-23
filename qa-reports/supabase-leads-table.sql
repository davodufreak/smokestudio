-- Tabla de leads (modal WhatsApp con score >= 80)
-- Ejecutar en Supabase > SQL Editor

create table public.leads (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  name text not null,
  phone text not null,
  score int,
  user_id uuid references public.users(id) on delete set null
);

alter table public.leads enable row level security;

-- Solo admins pueden leer leads (ajusta según tu rol)
create policy "service role can manage leads" on public.leads
  using (true) with check (true);
