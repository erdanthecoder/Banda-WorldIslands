-- mBank: a free card for every player and Hand Pay setup. Coffee for the café. (Applied as "banda_0003_mbank".)
alter table public.banda_players add column if not exists bank_card text;
alter table public.banda_players add column if not exists hand_pay boolean not null default false;
-- banda_bank_open() returns text: creates the player's card number once and returns it
-- banda_hand_setup() returns boolean: turns on Hand Pay (needs a card)
-- shop: coffee 200, latte 300, cocoa 250, tea 100, croissant 200 (kind food)
