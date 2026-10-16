-- Optional deployment migration: install this only on a Supabase target that supports pg_cron.
-- Kept separate from schema/RPC migrations so clean-chain validation works on plain PostgreSQL.
create extension if not exists pg_cron with schema pg_catalog;

do $scheduler$
begin
  if exists (
    select 1 from cron.job
    where jobname = 'tiba-finalize-expired-dispatch-windows'
  ) then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'tiba-finalize-expired-dispatch-windows';
  end if;

  perform cron.schedule(
    'tiba-finalize-expired-dispatch-windows',
    '* * * * *',
    $job$select public.finalize_expired_dispatch_windows();$job$
  );
end;
$scheduler$;
