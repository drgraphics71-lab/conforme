-- ============================================================
-- 001 — Socle.
-- Un utilisateur, un ou plusieurs espaces, un abonnement par espace.
-- À exécuter en premier dans le SQL Editor d'un projet Supabase neuf.
-- ============================================================

-- ------------------------------------------------------------- espaces

create table if not exists espaces (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  signature     text,
  logo_chemin   text,
  fuseau        text not null default 'Europe/Paris',
  cree_le       timestamptz not null default now()
);

create table if not exists membres (
  id             uuid primary key default gen_random_uuid(),
  espace_id      uuid not null references espaces(id) on delete cascade,
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  role           text not null default 'membre' check (role in ('proprietaire','membre')),
  cree_le        timestamptz not null default now(),
  unique (espace_id, utilisateur_id)
);

create index if not exists membres_utilisateur on membres(utilisateur_id);

create table if not exists abonnements (
  id             uuid primary key default gen_random_uuid(),
  espace_id      uuid not null unique references espaces(id) on delete cascade,
  formule        text not null default 'essai' check (formule in ('essai','solo','agence')),
  actif          boolean not null default true,
  quota_mensuel  integer not null default 50,
  consomme       integer not null default 0,
  renouvelle_le  date,
  cree_le        timestamptz not null default now()
);

-- --------------------------------------------------- accès (RLS)
--
-- Toute la sécurité repose sur une fonction unique : les espaces de
-- l'utilisateur connecté. Elle est en SECURITY DEFINER pour ne pas
-- déclencher la RLS de « membres » à l'intérieur des politiques, ce qui
-- provoquerait une récursion.

create or replace function mes_espaces()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select espace_id from membres where utilisateur_id = auth.uid()
$$;

alter table espaces     enable row level security;
alter table membres     enable row level security;
alter table abonnements enable row level security;

drop policy if exists espaces_membre on espaces;
create policy espaces_membre on espaces
  for all
  using      (id in (select mes_espaces()))
  with check (id in (select mes_espaces()));

drop policy if exists membres_soi on membres;
create policy membres_soi on membres
  for select
  using (utilisateur_id = auth.uid() or espace_id in (select mes_espaces()));

drop policy if exists abonnements_membre on abonnements;
create policy abonnements_membre on abonnements
  for select
  using (espace_id in (select mes_espaces()));

-- ------------------------------------------------- création d'un espace
--
-- Appelée par l'application au premier lancement, et depuis le sélecteur
-- d'espace. Crée l'espace, rattache l'appelant comme propriétaire et
-- ouvre un abonnement d'essai, le tout en une transaction.

create or replace function creer_espace(p_nom text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if coalesce(trim(p_nom), '') = '' then
    raise exception 'Nom manquant';
  end if;

  insert into espaces (nom) values (trim(p_nom)) returning id into v_id;
  insert into membres (espace_id, utilisateur_id, role) values (v_id, auth.uid(), 'proprietaire');
  insert into abonnements (espace_id) values (v_id);

  return v_id;
end $$;

grant execute on function creer_espace(text) to authenticated;
grant execute on function mes_espaces() to authenticated;

-- Vérification : select creer_espace('Test'); puis select * from espaces;
