-- Разделение погашений клуба / сетов и конверсия сет → клуб за 30 дней.

create or replace function public.get_weekly_festival_metrics(week_start date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_week date;
  v_from timestamptz;
  v_to timestamptz;
begin
  if week_start is null then
    v_week := public.report_last_complete_monday(now());
  else
    v_week := public.report_monday(week_start);
  end if;

  v_from := (v_week::timestamp at time zone 'Asia/Almaty');
  v_to := ((v_week + 7)::timestamp at time zone 'Asia/Almaty');

  return (
    with guests as (
      select p.id
      from public.profiles p
      where p.phone is not null
        and coalesce(p.user_kind, 'user') = 'user'
        and coalesce(p.role, 'user') <> 'admin'
        and not exists (
          select 1 from public.report_excluded_users e where e.user_id = p.id
        )
    ),
    week_r as (
      select
        r.*,
        coalesce(r.offer_type, o.offer_type) as resolved_type
      from public.redemptions r
      join guests g on g.id = r.user_id
      join public.offers o on o.id = r.offer_id
      where r.redeemed_at >= v_from
        and r.redeemed_at < v_to
        and not exists (
          select 1 from public.report_excluded_venues v where v.venue_id = r.restaurant_id
        )
    ),
    set_then_club as (
      select count(distinct s.user_id)::int as guests
      from public.redemptions s
      join guests g on g.id = s.user_id
      join public.redemptions c
        on c.user_id = s.user_id
       and c.restaurant_id = s.restaurant_id
       and c.redeemed_at > s.redeemed_at
       and c.redeemed_at <= s.redeemed_at + interval '30 days'
      where s.redeemed_at >= v_from
        and s.redeemed_at < v_to
        and coalesce(s.offer_type, '') = 'set'
        and coalesce(c.offer_type, '') in ('2for1', 'compliment')
        and not exists (
          select 1 from public.report_excluded_venues v where v.venue_id = s.restaurant_id
        )
    )
    select jsonb_build_object(
      'festival', jsonb_build_object(
        'club_redemptions', (
          select count(*)::int from week_r
          where resolved_type in ('2for1', 'compliment')
        ),
        'set_redemptions', (
          select count(*)::int from week_r where resolved_type = 'set'
        ),
        'set_then_club_30d_guests', (select guests from set_then_club)
      )
    )
  );
end;
$$;

revoke all on function public.get_weekly_festival_metrics(date) from public, anon, authenticated;
grant execute on function public.get_weekly_festival_metrics(date) to service_role;

-- Preserve the original weekly report body under a new name, then wrap.
do $$
begin
  if to_regprocedure('public.get_weekly_report_core(date)') is null
     and to_regprocedure('public.get_weekly_report(date)') is not null then
    alter function public.get_weekly_report(date) rename to get_weekly_report_core;
  end if;
end
$$;

create or replace function public.get_weekly_report(week_start date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_base jsonb;
  v_fest jsonb;
begin
  v_base := public.get_weekly_report_core(week_start);
  v_fest := public.get_weekly_festival_metrics(week_start);
  return coalesce(v_base, '{}'::jsonb) || coalesce(v_fest, '{}'::jsonb);
end;
$$;

revoke all on function public.get_weekly_report(date) from public, anon, authenticated;
revoke all on function public.get_weekly_report_core(date) from public, anon, authenticated;
grant execute on function public.get_weekly_report(date) to service_role;
grant execute on function public.get_weekly_report_core(date) to service_role;

comment on function public.get_weekly_report(date) is
  'Еженедельный отчёт + festival: club/set redemptions и set→club за 30 дней.';
