-- ============================================================
-- 004 — Nina, après-refus.
-- Déjà appliquée sur le projet « Agence IA ». Conservée pour référence.
-- ============================================================

create table if not exists pub_refus (
  id               uuid primary key default gen_random_uuid(),
  espace_id        uuid not null references espaces(id) on delete cascade,
  client_id        uuid not null references pub_clients(id) on delete cascade,
  annonce_id       uuid references pub_annonces(id) on delete set null,
  reference        text not null,
  captures         text[] not null default '{}',
  statut           text not null default 'nouveau'
                   check (statut in ('nouveau','traite','resolu','perdu')),

  -- Ce que Nina lit dans la capture.
  motif_affiche    text,
  politique        text,
  niveau           text not null default 'inconnu'
                   check (niveau in ('annonce','compte','page','catalogue','inconnu')),

  -- Ce qu'elle en déduit.
  cause            text,
  correction       text,
  texte_corrige    text,
  strategie        text check (strategie in ('corriger','revision','les_deux','abandonner')),
  demande_revision text,
  faux_positif     boolean not null default false,

  -- La boucle d'apprentissage : ce qui a réellement débloqué.
  resolution       text,
  resolu_le        timestamptz,

  analyse_le       timestamptz,
  cree_le          timestamptz not null default now()
);

create index if not exists pub_refus_espace on pub_refus(espace_id, cree_le desc);
create index if not exists pub_refus_client on pub_refus(client_id);

alter table pub_refus enable row level security;

drop policy if exists pub_refus_membre on pub_refus;
create policy pub_refus_membre on pub_refus
  for all
  using      (espace_id in (select mes_espaces()))
  with check (espace_id in (select mes_espaces()));
