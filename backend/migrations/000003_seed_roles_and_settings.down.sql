ELETE FROM system_settings WHERE key IN (
  'journey_default_days',
  'return_wait_days',
  'salary_daily_divisor',
  'max_sick_days',
  'commission_projection_basis'
);

DELETE FROM roles WHERE code IN (
  'ADMIN',
  'PLANNER',
  'MERCANTILE_OPERATOR',
  'FINANCE_VIEWER'
);