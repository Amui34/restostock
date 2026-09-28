-- =============================================================
--  RestoStock — base de données partagée, multi-entreprises
--
--  À exécuter dans Supabase : « SQL Editor » → « New query » →
--  coller ceci → « Run ». Rejouable sans danger.
--
--  Principe : chaque entreprise est cloisonnée. Personne ne voit les
--  données d'un autre établissement, et à l'intérieur d'une entreprise
--  chacun ne voit que ce que son rôle autorise. Ces règles sont
--  appliquées par la base elle-même, pas par l'application — un employé
--  qui bidouillerait la page ne verrait pas un prix de plus.
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Les entreprises
-- ---------------------------------------------------------------
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- Code à communiquer pour rejoindre l'équipe. Court, lisible à l'oral.
  join_code  text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6)),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 2. Les membres et leur rôle
-- ---------------------------------------------------------------
do $$ begin
  create type public.member_role as enum ('patron','manager','employe');
exception when duplicate_object then null;
end $$;

create table if not exists public.members (
  user_id    uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role       public.member_role not null default 'employe',
  full_name  text,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create index if not exists members_company_idx on public.members (company_id);

-- ---------------------------------------------------------------
-- 3. Les données de l'application
--    Une ligne = un produit, une fiche, un inventaire, un prix…
--    `company_id` cloisonne, `kind` permet de filtrer par rôle.
-- ---------------------------------------------------------------

-- Reprise d'une première version mono-entreprise : la table existait sans
-- `company_id`. On la remplace — mais jamais si elle contient déjà des
-- données, auquel cas on s'arrête net plutôt que de détruire quoi que ce soit.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'documents')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'documents'
                       and column_name = 'company_id')
  then
    if exists (select 1 from public.documents limit 1) then
      raise exception
        'La table « documents » contient des données dans l''ancien format mono-entreprise. Arrêt : rien n''a été modifié.';
    end if;
    drop table public.documents cascade;
    raise notice 'Ancienne table « documents » (vide) remplacée par la version multi-entreprises.';
  end if;
end $$;

create table if not exists public.documents (
  company_id uuid not null references public.companies(id) on delete cascade,
  id         text not null,
  kind       text not null,   -- product | price | recipe | inventory | sale | settings | meta
  ord        integer not null default 0,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create index if not exists documents_kind_idx on public.documents (company_id, kind);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists documents_touch on public.documents;
create trigger documents_touch
  before update on public.documents
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- 4. Qui suis-je, et qu'ai-je le droit de faire ?
--    `security definer` permet à ces fonctions de lire la table des
--    membres sans que l'utilisateur y ait accès directement.
-- ---------------------------------------------------------------
create or replace function public.my_role(c uuid)
returns public.member_role
language sql stable security definer set search_path = public as $$
  select role from public.members where user_id = auth.uid() and company_id = c
$$;

create or replace function public.is_member(c uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and company_id = c)
$$;

-- Ce qu'un employé n'a pas à connaître : les prix, les ventes, les réglages.
create or replace function public.kind_is_sensitive(k text)
returns boolean language sql immutable as $$
  select k in ('price','sale','settings')
$$;

-- ---------------------------------------------------------------
-- 5. Cloisonnement
-- ---------------------------------------------------------------
alter table public.companies  enable row level security;
alter table public.members    enable row level security;
alter table public.documents  enable row level security;

-- --- Entreprises : on ne voit que la sienne ; seul le patron la renomme.
drop policy if exists "voir son entreprise"     on public.companies;
drop policy if exists "patron modifie"          on public.companies;
create policy "voir son entreprise" on public.companies
  for select to authenticated using (public.is_member(id));
create policy "patron modifie" on public.companies
  for update to authenticated using (public.my_role(id) = 'patron')
  with check (public.my_role(id) = 'patron');

-- --- Membres : chacun voit l'équipe de son entreprise ; seul le patron la gère.
drop policy if exists "voir l equipe"    on public.members;
drop policy if exists "patron ajoute"    on public.members;
drop policy if exists "patron modifie m" on public.members;
drop policy if exists "patron retire"    on public.members;
create policy "voir l equipe" on public.members
  for select to authenticated using (public.is_member(company_id));
create policy "patron ajoute" on public.members
  for insert to authenticated with check (public.my_role(company_id) = 'patron');
create policy "patron modifie m" on public.members
  for update to authenticated using (public.my_role(company_id) = 'patron')
  with check (public.my_role(company_id) = 'patron');
create policy "patron retire" on public.members
  for delete to authenticated using (public.my_role(company_id) = 'patron');

-- --- Données : lecture filtrée par rôle
drop policy if exists "lecture selon role" on public.documents;
create policy "lecture selon role" on public.documents
  for select to authenticated using (
    public.is_member(company_id)
    and (
      public.my_role(company_id) in ('patron','manager')
      or not public.kind_is_sensitive(kind)
    )
  );

-- --- Données : écriture selon rôle
--     employé  → le stock (réceptions) et les inventaires EN COURS
--     manager  → tout sauf les réglages ; ne touche plus un inventaire validé
--     patron   → tout
--
--  Un inventaire validé est une archive : il a servi à calculer des pertes et
--  des écarts, le rouvrir réécrirait l'histoire. Seul le patron peut encore
--  intervenir, et c'est volontairement inconfortable.
create or replace function public.can_write_doc(c uuid, k text, d jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select case public.my_role(c)
    when 'patron'  then true
    when 'manager' then k <> 'settings'
                    and not (k = 'inventory' and d->>'status' = 'validated')
    when 'employe' then k = 'product'
                    or (k = 'inventory' and coalesce(d->>'status','') = 'in_progress')
    else false
  end
$$;

drop policy if exists "ecriture selon role"     on public.documents;
drop policy if exists "modification selon role" on public.documents;
drop policy if exists "suppression selon role"  on public.documents;

create policy "ecriture selon role" on public.documents
  for insert to authenticated
  with check (public.can_write_doc(company_id, kind, data));

-- USING porte sur la ligne AVANT modification, WITH CHECK sur celle d'APRÈS :
-- les deux doivent être autorisées. C'est ce qui empêche un employé de clore
-- un inventaire, et quiconque d'en rouvrir un déjà validé.
create policy "modification selon role" on public.documents
  for update to authenticated
  using (public.can_write_doc(company_id, kind, data))
  with check (public.can_write_doc(company_id, kind, data));

create policy "suppression selon role" on public.documents
  for delete to authenticated
  using (public.can_write_doc(company_id, kind, data));

-- ---------------------------------------------------------------
-- 6. Créer son entreprise, ou rejoindre celle d'un collègue
-- ---------------------------------------------------------------
create or replace function public.create_company(company_name text, who text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  insert into public.companies (name) values (company_name) returning id into cid;
  insert into public.members (user_id, company_id, role, full_name)
    values (auth.uid(), cid, 'patron', who);
  return cid;
end $$;

-- Le nouveau venu entre le code reçu de son patron. Il arrive en « employé » ;
-- le patron l'élève ensuite s'il le faut. Personne ne s'auto-promeut.
create or replace function public.join_company(code text, who text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select id into cid from public.companies where join_code = upper(trim(code));
  if cid is null then raise exception 'Code invalide'; end if;
  insert into public.members (user_id, company_id, role, full_name)
    values (auth.uid(), cid, 'employe', who)
    on conflict (user_id, company_id) do nothing;
  return cid;
end $$;

-- Les entreprises auxquelles j'appartiens, avec mon rôle.
create or replace function public.my_companies()
returns table (company_id uuid, company_name text, role public.member_role, join_code text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, m.role,
         case when m.role = 'patron' then c.join_code else null end
  from public.members m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid()
$$;

-- ---------------------------------------------------------------
-- 7. Mise à jour en direct entre les écrans ouverts
-- ---------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.documents;
exception
  when duplicate_object then null;   -- déjà activé
  when undefined_object then null;   -- publication absente (hors Supabase)
end $$;

-- =============================================================
--  Terminé. Plus besoin de créer d'utilisateur à la main :
--  chacun s'inscrit depuis l'application, le patron crée son
--  entreprise, et les autres la rejoignent avec le code.
-- =============================================================
