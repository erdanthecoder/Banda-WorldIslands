-- Money (mPAY) and the supermarket. Everyone starts with $100 (10000 cents).
-- See the applied migration "banda_0002_money_shop" in the Supabase project for the full SQL.
alter table public.banda_players add column if not exists money_cents int not null default 10000 check (money_cents >= 0);
alter table public.banda_players add column if not exists earn_day date;
alter table public.banda_players add column if not exists earn_today int not null default 0;
-- banda_shop (prices), banda_inventory (what each player owns),
-- banda_earn(cents) max $5 a time / $60 a day, banda_buy(items jsonb) pays with server-side prices,
-- banda_use(item) uses one food or toy.
