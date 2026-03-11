-- Balfour Beatty Signage Portal — Supabase Schema
-- Run this in Supabase SQL Editor to create the required tables.

-- Orders table
create table bal_orders (
  id            bigserial primary key,
  order_number  text unique not null,
  status        text not null default 'new' check (status in ('new','in-progress','completed','cancelled')),
  contact_name  text not null,
  email         text not null,
  phone         text not null,
  site_name     text not null,
  site_address  text not null,
  po_number     text,
  notes         text,
  subtotal      numeric(10,2) not null,
  vat           numeric(10,2) not null,
  total         numeric(10,2) not null,
  created_at    timestamptz default now()
);

-- Order items table
create table bal_order_items (
  id          bigserial primary key,
  order_id    bigint not null references bal_orders(id) on delete cascade,
  code        text not null,
  base_code   text,
  name        text not null,
  size        text,
  material    text,
  price       numeric(10,2) not null,
  quantity    integer not null check (quantity > 0),
  line_total  numeric(10,2) not null,
  custom_data jsonb default null
);

-- Suggestions table
create table bal_suggestions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  message     text not null,
  status      text not null default 'new' check (status in ('new','noted','done','dismissed')),
  created_at  timestamptz default now()
);

-- Indexes for dashboard queries
create index idx_bal_orders_created_at on bal_orders(created_at desc);
create index idx_bal_order_items_order_id on bal_order_items(order_id);
create index idx_bal_order_items_code on bal_order_items(code);
create index idx_bal_suggestions_created_at on bal_suggestions(created_at desc);

-- Row Level Security (service role has full access)
alter table bal_orders enable row level security;
alter table bal_order_items enable row level security;
alter table bal_suggestions enable row level security;

create policy "service_bal_orders" on bal_orders for all using (true) with check (true);
create policy "service_bal_order_items" on bal_order_items for all using (true) with check (true);
create policy "service_bal_suggestions" on bal_suggestions for all using (true) with check (true);
