-- Flag for offers that are valid for takeaway only (not dine-in).
alter table public.offers
  add column if not exists takeaway_only boolean not null default false;

comment on column public.offers.takeaway_only is
  'When true, the offer applies to takeaway / to-go orders only.';
