-- ════════════════════════════════════════════════════════════════════
--  PERGAMENA · schema di sincronizzazione
--
--  Da incollare una volta sola nel SQL Editor di Supabase.
--  È sicuro rilanciarlo: non distrugge niente.
--
--  Il modello è volutamente minimo: una sola tabella, un registro di
--  aggiornamenti Yjs. Non c'è una tabella «documenti» né «quaderni»,
--  perché quelli vivono DENTRO a un documento Yjs come tutto il resto.
--  Meno schema qui significa nessuna migrazione da fare ogni volta che
--  cambia la forma degli appunti.
-- ════════════════════════════════════════════════════════════════════

create table if not exists aggiornamenti (
  id      bigint generated always as identity primary key,
  utente  uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  stanza  text   not null,   -- 'indice' oppure 'doc:<id>'
  dati    text   not null,   -- aggiornamento Yjs, in base64
  creato  timestamptz not null default now()
);

-- la lettura è sempre «dammi la mia stanza, dall'id N in poi»
create index if not exists aggiornamenti_per_stanza
  on aggiornamenti (utente, stanza, id);

alter table aggiornamenti enable row level security;

-- ── ogni riga appartiene a chi l'ha scritta, e a nessun altro ──────
drop policy if exists "leggo solo i miei"    on aggiornamenti;
drop policy if exists "scrivo solo i miei"   on aggiornamenti;
drop policy if exists "cancello solo i miei" on aggiornamenti;

create policy "leggo solo i miei"
  on aggiornamenti for select using (auth.uid() = utente);

create policy "scrivo solo i miei"
  on aggiornamenti for insert with check (auth.uid() = utente);

create policy "cancello solo i miei"
  on aggiornamenti for delete using (auth.uid() = utente);

-- ── notifiche in tempo reale verso gli altri dispositivi ───────────
do $$
begin
  alter publication supabase_realtime add table aggiornamenti;
exception
  when duplicate_object then null;   -- già aggiunta: va bene
end
$$;


-- ════════════════════════════════════════════════════════════════════
--  Immagini
--
--  I byte non possono stare nel documento Yjs (lo gonfierebbero) né
--  solo in locale (un backup che perde le immagini non è un backup).
--  Vanno in un secchio privato, una cartella per utente.
--
--  I metadati — didascalia, attribuzione, larghezza — stanno già negli
--  attributi del nodo dentro al Yjs, quindi qui servono solo i byte.
-- ════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit)
values ('immagini', 'immagini', false, 15728640)   -- 15 MB per file
on conflict (id) do nothing;

drop policy if exists "immagini leggo le mie"    on storage.objects;
drop policy if exists "immagini carico le mie"   on storage.objects;
drop policy if exists "immagini cancello le mie" on storage.objects;

-- il primo pezzo del percorso è l'id dell'utente: <uid>/<id-immagine>
create policy "immagini leggo le mie" on storage.objects for select
  using (bucket_id = 'immagini' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "immagini carico le mie" on storage.objects for insert
  with check (bucket_id = 'immagini' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "immagini cancello le mie" on storage.objects for delete
  using (bucket_id = 'immagini' and (storage.foldername(name))[1] = auth.uid()::text);
