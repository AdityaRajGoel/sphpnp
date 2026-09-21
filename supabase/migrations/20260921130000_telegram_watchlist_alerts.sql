-- Telegram alerts for a visitor's watchlist. The watchlist itself lives in the
-- browser; a one-time token carries it to the bot, which keeps the chat's list.
-- Service role only: no visitor reads or writes these tables directly.

create table if not exists public.telegram_link_tokens (
  token      text primary key,
  symbols    text[] not null,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_subscriptions (
  chat_id    bigint not null,
  symbol     text not null,
  created_at timestamptz not null default now(),
  primary key (chat_id, symbol)
);
create index if not exists telegram_subscriptions_symbol_idx on public.telegram_subscriptions (symbol);

-- One row per alert delivered, so a flag that stays true is sent once, not every run.
create table if not exists public.telegram_alerts_sent (
  chat_id   bigint not null,
  alert_key text not null,
  sent_at   timestamptz not null default now(),
  primary key (chat_id, alert_key)
);

alter table public.telegram_link_tokens enable row level security;
alter table public.telegram_subscriptions enable row level security;
alter table public.telegram_alerts_sent enable row level security;
