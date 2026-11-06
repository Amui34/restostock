-- =============================================================
--  RestoStock -- suppression de compte (RGPD), variante SANS ACCENT
--
--  Meme contenu que la section 8 de supabase-schema.sql, mais sans un
--  seul caractere non-ASCII. L'editeur SQL du tableau de bord Supabase
--  abime les accents colles dans la page : "Termine" y devenait du
--  charabia, et les messages lus par l'equipe seraient illisibles.
--
--  Les accents des messages destines aux utilisateurs sont donc ecrits
--  en code Unicode, avec la syntaxe E'...' ; la syntaxe U&'...' est
--  refusee dans un RAISE. Verifie sur un vrai Postgres : la base renvoie
--  bien "Vous etes le seul responsable" avec son accent circonflexe.
--
--  A utiliser UNIQUEMENT pour un collage dans le tableau de bord.
--  Le fichier de reference reste supabase-schema.sql, en UTF-8.
--
--  Joue sur le projet Restostock le 6 novembre 2026.
-- =============================================================

-- ---------------------------------------------------------------
-- 8. S'en aller - quitter une equipe, fermer un etablissement,
--    supprimer son compte
--
--  Le RGPD donne a chacun le droit d'effacer ses donnees. Mais effacer
--  n'importe quoi n'importe quand casserait l'etablissement des autres :
--  ces fonctions refusent les suppressions qui laisseraient une equipe
--  sans responsable, c'est-a-dire sans personne pouvant encore gerer
--  les roles ou les reglages.
--
--  Aucune de ces operations n'est reversible : il n'y a pas de corbeille.
--  C'est volontaire - une corbeille qui conserve les donnees contredirait
--  le droit a l'effacement qu'elles servent a exercer.
-- ---------------------------------------------------------------

-- Fermer l'etablissement : emporte l'equipe et toutes les donnees
-- (produits, fiches, inventaires, ventes) par cascade.
create or replace function public.delete_company(c uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_role(c) is distinct from 'patron' then
    raise exception E'Seul le responsable peut supprimer l''\u00e9tablissement.';
  end if;
  delete from public.companies where id = c;
end $$;

-- Quitter une equipe. Le compte et les autres etablissements survivent ;
-- les donnees de l'etablissement quitte lui appartiennent et restent.
create or replace function public.leave_company(c uuid)
returns void language plpgsql security definer set search_path = public as $$
declare patrons int;
begin
  if not public.is_member(c) then
    raise exception E'Vous ne faites pas partie de cet \u00e9tablissement.';
  end if;
  if public.my_role(c) = 'patron' then
    select count(*) into patrons
      from public.members where company_id = c and role = 'patron';
    if patrons <= 1 then
      raise exception E'Vous \u00eates le seul responsable : nommez quelqu''un d''autre avant de quitter l''\u00e9tablissement.';
    end if;
  end if;
  delete from public.members where company_id = c and user_id = auth.uid();
end $$;

-- Supprimer son compte. Refuse tant que la personne est seule responsable
-- d'un etablissement : le fermer ou passer la main est un choix qui lui
-- revient, pas un effet de bord d'une suppression de compte.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare bloquants text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;

  select string_agg(c.name, ', ')
    into bloquants
    from public.members m
    join public.companies c on c.id = m.company_id
   where m.user_id = auth.uid()
     and m.role = 'patron'
     and (select count(*) from public.members m2
           where m2.company_id = m.company_id and m2.role = 'patron') = 1;

  if bloquants is not null then
    raise exception
      E'Vous \u00eates le seul responsable de : %. Supprimez ces \u00e9tablissements, ou nommez un autre responsable, avant de supprimer votre compte.', bloquants;
  end if;

  delete from auth.users where id = auth.uid();
end $$;

-- Ces fonctions n'ont aucun sens pour un visiteur non connecte.
revoke execute on function public.delete_company(uuid)   from anon;
revoke execute on function public.leave_company(uuid)    from anon;
revoke execute on function public.delete_my_account()    from anon;

-- =============================================================
--  Termine. Plus besoin de creer d'utilisateur a la main :
--  chacun s'inscrit depuis l'application, le patron cree son
--  entreprise, et les autres la rejoignent avec le code.
-- =============================================================
