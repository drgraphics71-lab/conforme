-- ============================================================
-- 002 — Gaby, conformité publicitaire.
-- À exécuter après 001_socle.sql.
-- ============================================================

-- ------------------------------------------------------------ clients

create table if not exists pub_clients (
  id            uuid primary key default gen_random_uuid(),
  espace_id     uuid not null references espaces(id) on delete cascade,
  nom           text not null,
  verticale     text not null default 'autre'
                check (verticale in ('ecommerce','formation','crypto','finance','sante','services','autre')),
  compte_meta   text,
  contact_email text,
  notes         text,
  -- Comment Gaby s'adresse à ce client dans la réponse.
  vouvoiement   boolean not null default true,
  signature     text,
  cree_le       timestamptz not null default now()
);

create index if not exists pub_clients_entreprise on pub_clients(espace_id);

-- --------------------------------------------------------------- lots

create table if not exists pub_lots (
  id                uuid primary key default gen_random_uuid(),
  espace_id     uuid not null references espaces(id) on delete cascade,
  client_id         uuid not null references pub_clients(id) on delete cascade,
  titre             text not null,
  statut            text not null default 'brouillon'
                    check (statut in ('brouillon','analyse','analyse_ok','repondu')),
  message_client    text,
  message_envoye_le timestamptz,
  analyse_le        timestamptz,
  cree_le           timestamptz not null default now()
);

create index if not exists pub_lots_entreprise on pub_lots(espace_id, cree_le desc);

-- ----------------------------------------------------------- annonces

create table if not exists pub_annonces (
  id              uuid primary key default gen_random_uuid(),
  espace_id   uuid not null references espaces(id) on delete cascade,
  lot_id          uuid not null references pub_lots(id) on delete cascade,
  reference       text not null,
  texte_principal text not null default '',
  titre           text,
  description     text,
  cta             text,
  url_destination text,
  pays            text not null default 'FR',
  format          text not null default 'image'
                  check (format in ('image','video','carrousel','texte')),
  visuel_chemin   text,
  verdict         text check (verdict in ('conforme','a_corriger','refus_probable')),
  risque          integer check (risque between 0 and 100),
  lecture_visuel  text,
  analyse_le      timestamptz,
  cree_le         timestamptz not null default now()
);

create index if not exists pub_annonces_lot on pub_annonces(lot_id, cree_le);

-- ------------------------------------------------------------- points

create table if not exists pub_points (
  id            uuid primary key default gen_random_uuid(),
  espace_id     uuid not null references espaces(id) on delete cascade,
  annonce_id    uuid not null references pub_annonces(id) on delete cascade,
  regle_id      text not null,
  source        text not null default 'auto' check (source in ('auto','ia','maison')),
  gravite       text not null check (gravite in ('bloquant','risque','avertissement')),
  politique     text not null,
  extrait       text,
  pourquoi      text not null,
  correction    text not null,
  ecarte        boolean not null default false,
  cree_le       timestamptz not null default now()
);

create index if not exists pub_points_annonce on pub_points(annonce_id);

-- ------------------------------------------------------- règles maison

create table if not exists pub_regles_maison (
  id            uuid primary key default gen_random_uuid(),
  espace_id     uuid not null references espaces(id) on delete cascade,
  client_id     uuid references pub_clients(id) on delete cascade,
  motif         text not null,
  gravite       text not null default 'risque' check (gravite in ('bloquant','risque','avertissement')),
  politique     text not null default 'Règle interne',
  pourquoi      text not null default '',
  correction    text not null default '',
  actif         boolean not null default true,
  cree_le       timestamptz not null default now()
);

create index if not exists pub_regles_maison_entreprise on pub_regles_maison(espace_id);

-- ------------------------------------------------------ accès (RLS)

alter table pub_clients       enable row level security;
alter table pub_lots          enable row level security;
alter table pub_annonces      enable row level security;
alter table pub_points        enable row level security;
alter table pub_regles_maison enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pub_clients','pub_lots','pub_annonces','pub_points','pub_regles_maison']
  loop
    execute format('drop policy if exists %I on %I', t || '_membre', t);
    execute format($f$
      create policy %I on %I
        for all
        using      (espace_id in (select mes_espaces()))
        with check (espace_id in (select mes_espaces()))
    $f$, t || '_membre', t);
  end loop;
end $$;

-- --------------------------------------------------- stockage visuels

insert into storage.buckets (id, name, public)
values ('pubs', 'pubs', false)
on conflict (id) do nothing;

drop policy if exists "pubs lecture membre" on storage.objects;
create policy "pubs lecture membre" on storage.objects
  for select using (
    bucket_id = 'pubs'
    and (storage.foldername(name))[1] in (select mes_espaces()::text)
  );

drop policy if exists "pubs ecriture membre" on storage.objects;
create policy "pubs ecriture membre" on storage.objects
  for insert with check (
    bucket_id = 'pubs'
    and (storage.foldername(name))[1] in (select mes_espaces()::text)
  );

drop policy if exists "pubs maj membre" on storage.objects;
create policy "pubs maj membre" on storage.objects
  for update using (
    bucket_id = 'pubs'
    and (storage.foldername(name))[1] in (select mes_espaces()::text)
  );

drop policy if exists "pubs suppression membre" on storage.objects;
create policy "pubs suppression membre" on storage.objects
  for delete using (
    bucket_id = 'pubs'
    and (storage.foldername(name))[1] in (select mes_espaces()::text)
  );

-- Vérification : select count(*) from pub_clients;


-- --------------------------------------------------- vidéos


-- Une annonce vidéo porte plusieurs images clés, une transcription et
-- une durée. Le visuel unique reste utilisé pour la vignette.
alter table pub_annonces
  add column if not exists audio_chemin  text,
  add column if not exists transcription text,
  add column if not exists duree_s       numeric;

-- Images extraites d'une vidéo, avec leur position dans le temps.
create table if not exists pub_visuels (
  id            uuid primary key default gen_random_uuid(),
  espace_id     uuid not null references espaces(id) on delete cascade,
  annonce_id    uuid not null references pub_annonces(id) on delete cascade,
  chemin        text not null,
  timecode_s    numeric not null default 0,
  cree_le       timestamptz not null default now()
);

create index if not exists pub_visuels_annonce on pub_visuels(annonce_id, timecode_s);

alter table pub_visuels enable row level security;

drop policy if exists pub_visuels_membre on pub_visuels;
create policy pub_visuels_membre on pub_visuels
  for all
  using      (espace_id in (select mes_espaces()))
  with check (espace_id in (select mes_espaces()));

-- Les fichiers d'une même annonce vivent dans un sous-dossier :
-- <espace_id>/<annonce_id>/img-0007.jpg, .../audio.wav
-- Les politiques du bucket « pubs » se basent sur le premier segment,
-- elles restent valables telles quelles.
