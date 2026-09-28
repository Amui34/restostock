-- =============================================================
--  Livre de Prix — Bivouak
--  Préparation de la base de données partagée
--
--  À exécuter UNE SEULE FOIS, à la création du projet Supabase.
--  Où : menu « SQL Editor » → bouton « New query » → coller ceci → « Run ».
--  Le script peut être relancé sans danger : il ne détruit aucune donnée.
-- =============================================================

-- ---------------------------------------------------------------
-- 1. La table unique où vit tout le livre de prix.
--    Une ligne = un produit, une fiche, un inventaire ou un réglage.
--    C'est ce découpage qui permet à deux personnes de saisir en même
--    temps sans écraser le travail de l'autre.
-- ---------------------------------------------------------------
create table if not exists public.documents (
  id         text primary key,          -- ex. « product/p12 », « recipe/r20 »
  kind       text not null,             -- product | recipe | inventory | sale | settings | meta
  ord        integer not null default 0,-- conserve l'ordre d'affichage d'origine
  data       jsonb not null,            -- le contenu lui-même
  updated_at timestamptz not null default now()
);

create index if not exists documents_kind_idx on public.documents (kind);

-- ---------------------------------------------------------------
-- 2. Date de dernière modification tenue à jour toute seule.
-- ---------------------------------------------------------------
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
-- 3. Sécurité.
--    Sans cette partie, n'importe qui connaissant l'adresse du site
--    pourrait lire ET modifier vos prix. Avec elle, il faut être
--    connecté avec l'identifiant de l'équipe.
-- ---------------------------------------------------------------
alter table public.documents enable row level security;

drop policy if exists "equipe lecture"      on public.documents;
drop policy if exists "equipe insertion"    on public.documents;
drop policy if exists "equipe modification" on public.documents;
drop policy if exists "equipe suppression"  on public.documents;

create policy "equipe lecture"      on public.documents
  for select to authenticated using (true);
create policy "equipe insertion"    on public.documents
  for insert to authenticated with check (true);
create policy "equipe modification" on public.documents
  for update to authenticated using (true) with check (true);
create policy "equipe suppression"  on public.documents
  for delete to authenticated using (true);

-- ---------------------------------------------------------------
-- 4. Mise à jour en direct : quand quelqu'un enregistre une livraison,
--    les autres écrans ouverts en sont avertis.
-- ---------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.documents;
exception
  when duplicate_object then null;   -- déjà activé, rien à faire
end $$;

-- =============================================================
--  Terminé. Il reste à créer le compte de l'équipe :
--  menu « Authentication » → « Users » → « Add user » →
--  « Create new user », avec une adresse e-mail et un mot de passe
--  communs, et l'option de confirmation automatique activée.
-- =============================================================
