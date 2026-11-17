-- Run once in the Supabase SQL editor. All mail writes go through the server.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40)
);
create table if not exists public.messages (
  id uuid primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender text not null,
  sender_name text not null,
  email_from text not null,
  reply_url text not null,
  recipient text not null,
  subject text not null check (char_length(subject) between 1 and 120),
  body text not null check (char_length(body) between 1 and 10000),
  station text not null check (station in ('earth','mars')),
  created_at timestamptz not null default now(),
  delivery_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','scheduled','failed')),
  provider_id text,
  check (sender <> recipient)
);
create index if not exists messages_sender_date on public.messages(sender_id, created_at desc);
alter table public.profiles enable row level security;
alter table public.messages enable row level security;
-- No browser database policies. The server checks the verified user before using its service key.
revoke all on public.profiles, public.messages from anon, authenticated;

create or replace function public.reserve_message(packet jsonb)
returns setof public.messages
language plpgsql security definer set search_path = public
as $$
declare existing public.messages; sender_uuid uuid := (packet->>'sender_id')::uuid;
begin
  perform pg_advisory_xact_lock(hashtext(sender_uuid::text));
  select * into existing from public.messages where id = (packet->>'id')::uuid;
  if found then
    if existing.sender_id <> sender_uuid then raise exception 'Packet unavailable'; end if;
    return next existing; return;
  end if;
  if (select count(*) from public.messages where sender_id = sender_uuid and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Daily limit reached';
  end if;
  -- Ignore any client-provided delivery date; compute 168 hours in the database.
  return query insert into public.messages(id,sender_id,sender,sender_name,email_from,reply_url,recipient,subject,body,station,delivery_at)
    values ((packet->>'id')::uuid,sender_uuid,packet->>'sender',packet->>'sender_name',packet->>'email_from',packet->>'reply_url',packet->>'recipient',packet->>'subject',packet->>'body',packet->>'station',now() + interval '168 hours') returning *;
end;
$$;
revoke all on function public.reserve_message(jsonb) from public, anon, authenticated;
grant execute on function public.reserve_message(jsonb) to service_role;
