create sequence if not exists public.driver_code_seq start with 1 increment by 1;
revoke all on sequence public.driver_code_seq from public,anon,authenticated;