-- error_logs: RLS не был включён в исходных миграциях; запись идёт только через service_role.
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
