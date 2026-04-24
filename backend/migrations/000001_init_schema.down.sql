PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS current_account_entries;
DROP TABLE IF EXISTS earning_accrual_items;
DROP TABLE IF EXISTS earning_accrual_batches;
DROP TABLE IF EXISTS expense_items;
DROP TABLE IF EXISTS expense_transactions;
DROP TABLE IF EXISTS price_list_items;
DROP TABLE IF EXISTS gold_prices;
DROP TABLE IF EXISTS mine_well_productions;
DROP TABLE IF EXISTS work_plan_items;
DROP TABLE IF EXISTS work_periods;
DROP TABLE IF EXISTS collaborator_journeys;
DROP TABLE IF EXISTS people;
DROP TABLE IF EXISTS reference_data;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;

PRAGMA foreign_keys = ON;