-- blog_ai_telemetry
create table if not exists blog_ai_telemetry (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  tool_name text not null,
  action text,
  target text,
  apply_mode text,
  status text,
  error_message text,
  item_count int,
  slug text,
  category text,
  tags text[],
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table blog_ai_telemetry enable row level security;
create policy "Admins can view telemetry" on blog_ai_telemetry for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Authenticated can insert telemetry" on blog_ai_telemetry for insert to authenticated with check (true);

-- blog_ai_audit_log
create table if not exists blog_ai_audit_log (
  id uuid primary key default gen_random_uuid(),
  tool_name text not null,
  before_value text not null default '',
  after_value text not null default '',
  apply_mode text not null default 'advisory',
  target_field text,
  slug text,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table blog_ai_audit_log enable row level security;
create policy "Admins can view audit log" on blog_ai_audit_log for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Authenticated can insert audit log" on blog_ai_audit_log for insert to authenticated with check (true);