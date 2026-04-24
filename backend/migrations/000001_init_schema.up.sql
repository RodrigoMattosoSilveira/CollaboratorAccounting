PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_user_roles_user_role ON user_roles(user_id, role_id);

CREATE TABLE reference_data (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
CREATE UNIQUE INDEX ux_reference_data_type_code ON reference_data(type, code);
CREATE INDEX idx_reference_data_type_active_sort ON reference_data(type, active, sort_order);

CREATE TABLE people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NULL,
  phone TEXT NULL,
  email TEXT NULL,
  cpf TEXT NULL,
  bank_data TEXT NULL,
  pix_key TEXT NULL,
  emergency_contact_name TEXT NULL,
  emergency_contact_phone TEXT NULL,
  emergency_contact_notes TEXT NULL,
  status_id TEXT NOT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_people_status FOREIGN KEY (status_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_people_name ON people(name);
CREATE UNIQUE INDEX ux_people_phone ON people(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX ux_people_email ON people(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX ux_people_cpf ON people(cpf) WHERE cpf IS NOT NULL;
CREATE UNIQUE INDEX ux_people_pix_key ON people(pix_key) WHERE pix_key IS NOT NULL;
CREATE INDEX idx_people_status_id ON people(status_id);

CREATE TABLE collaborator_journeys (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  journey_start_date DATE NOT NULL,
  default_end_date DATE NOT NULL,
  extension_days INTEGER NOT NULL DEFAULT 0,
  projected_end_date DATE NOT NULL,
  payment_method_id TEXT NOT NULL,
  payment_value NUMERIC NOT NULL,
  sector_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  status_id TEXT NOT NULL,
  notes TEXT NULL,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_collab_person FOREIGN KEY (person_id) REFERENCES people(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_collab_payment_method FOREIGN KEY (payment_method_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_collab_sector FOREIGN KEY (sector_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_collab_location FOREIGN KEY (location_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_collab_task FOREIGN KEY (task_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_collab_status FOREIGN KEY (status_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX idx_collab_person_id ON collaborator_journeys(person_id);
CREATE INDEX idx_collab_status_id ON collaborator_journeys(status_id);
CREATE INDEX idx_collab_projected_end_date ON collaborator_journeys(projected_end_date);
CREATE INDEX idx_collab_location_id ON collaborator_journeys(location_id);
CREATE INDEX idx_collab_payment_method_id ON collaborator_journeys(payment_method_id);

CREATE TABLE work_periods (
  id TEXT PRIMARY KEY,
  work_date DATE NOT NULL,
  period_code TEXT NOT NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  status TEXT NOT NULL,
  seeded_from_work_period_id TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_work_period_seeded_from FOREIGN KEY (seeded_from_work_period_id) REFERENCES work_periods(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_work_periods_date_period ON work_periods(work_date, period_code);
CREATE INDEX idx_work_periods_status ON work_periods(status);

CREATE TABLE work_plan_items (
  id TEXT PRIMARY KEY,
  work_period_id TEXT NOT NULL,
  collaborator_id TEXT NOT NULL,
  include_flag INTEGER NOT NULL DEFAULT 1,
  sector_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  method_id TEXT NOT NULL,
  payment_value_snapshot NUMERIC NOT NULL,
  assignment_status TEXT NOT NULL,
  substituted_for_collaborator_id TEXT NULL,
  exception_type TEXT NULL,
  comments TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_plan_work_period FOREIGN KEY (work_period_id) REFERENCES work_periods(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plan_collaborator FOREIGN KEY (collaborator_id) REFERENCES collaborator_journeys(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plan_sector FOREIGN KEY (sector_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plan_location FOREIGN KEY (location_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plan_task FOREIGN KEY (task_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plan_method FOREIGN KEY (method_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plan_substituted_for FOREIGN KEY (substituted_for_collaborator_id) REFERENCES collaborator_journeys(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_work_plan_items_work_period_collaborator ON work_plan_items(work_period_id, collaborator_id);
CREATE INDEX idx_work_plan_items_location_id ON work_plan_items(location_id);
CREATE INDEX idx_work_plan_items_substituted_for ON work_plan_items(substituted_for_collaborator_id);

CREATE TABLE mine_well_productions (
  id TEXT PRIMARY KEY,
  work_period_id TEXT NOT NULL,
  work_date DATE NOT NULL,
  period_code TEXT NOT NULL,
  location_id TEXT NOT NULL,
  grams_produced NUMERIC NOT NULL,
  comments TEXT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_production_work_period FOREIGN KEY (work_period_id) REFERENCES work_periods(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_production_location FOREIGN KEY (location_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_production_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_production_date_period_location ON mine_well_productions(work_date, period_code, location_id);
CREATE INDEX idx_production_work_period_id ON mine_well_productions(work_period_id);
CREATE INDEX idx_production_location_id ON mine_well_productions(location_id);

CREATE TABLE gold_prices (
  id TEXT PRIMARY KEY,
  quote_date DATE NOT NULL,
  quoted_at_time TEXT NULL,
  price_brl_per_gram NUMERIC NOT NULL,
  source_name TEXT NULL,
  comments TEXT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_gold_prices_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_gold_prices_quote_date ON gold_prices(quote_date);
CREATE INDEX idx_gold_prices_quote_date_desc ON gold_prices(quote_date DESC);

CREATE TABLE price_list_items (
  id TEXT PRIMARY KEY,
  code TEXT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  category_id TEXT NOT NULL,
  price_brl NUMERIC NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_price_list_category FOREIGN KEY (category_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_price_list_items_name ON price_list_items(name);
CREATE UNIQUE INDEX ux_price_list_items_code ON price_list_items(code) WHERE code IS NOT NULL;
CREATE INDEX idx_price_list_category_active ON price_list_items(category_id, active);

CREATE TABLE expense_transactions (
  id TEXT PRIMARY KEY,
  collaborator_id TEXT NOT NULL,
  expense_date DATE NOT NULL,
  currency_code TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  category_id TEXT NOT NULL,
  gold_price_id TEXT NULL,
  collaborator_agreement INTEGER NOT NULL DEFAULT 0,
  comments TEXT NULL,
  posted_ledger_group_id TEXT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_expense_collaborator FOREIGN KEY (collaborator_id) REFERENCES collaborator_journeys(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_expense_category FOREIGN KEY (category_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_expense_gold_price FOREIGN KEY (gold_price_id) REFERENCES gold_prices(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_expense_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX idx_expense_transactions_collaborator_id ON expense_transactions(collaborator_id);
CREATE INDEX idx_expense_transactions_expense_date ON expense_transactions(expense_date);
CREATE INDEX idx_expense_transactions_category_id ON expense_transactions(category_id);
CREATE INDEX idx_expense_transactions_currency_code ON expense_transactions(currency_code);

CREATE TABLE expense_items (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL,
  price_list_item_id TEXT NULL,
  item_name_snapshot TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  comments TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_expense_item_expense FOREIGN KEY (expense_id) REFERENCES expense_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_expense_item_price_list FOREIGN KEY (price_list_item_id) REFERENCES price_list_items(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX idx_expense_items_expense_id ON expense_items(expense_id);
CREATE INDEX idx_expense_items_price_list_item_id ON expense_items(price_list_item_id);

CREATE TABLE earning_accrual_batches (
  id TEXT PRIMARY KEY,
  work_period_id TEXT NOT NULL,
  accrual_status TEXT NOT NULL,
  comments TEXT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_accrual_batch_work_period FOREIGN KEY (work_period_id) REFERENCES work_periods(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_accrual_batch_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ux_accrual_batches_work_period_id ON earning_accrual_batches(work_period_id);
CREATE INDEX idx_accrual_batches_status ON earning_accrual_batches(accrual_status);

CREATE TABLE earning_accrual_items (
  id TEXT PRIMARY KEY,
  accrual_batch_id TEXT NOT NULL,
  collaborator_id TEXT NOT NULL,
  work_plan_item_id TEXT NULL,
  method_id TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  calculation_basis_json TEXT NOT NULL,
  gross_amount NUMERIC NOT NULL,
  transfer_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL,
  hold_reason TEXT NULL,
  ledger_entry_id TEXT NULL,
  status TEXT NOT NULL,
  comments TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_accrual_item_batch FOREIGN KEY (accrual_batch_id) REFERENCES earning_accrual_batches(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_accrual_item_collaborator FOREIGN KEY (collaborator_id) REFERENCES collaborator_journeys(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_accrual_item_work_plan FOREIGN KEY (work_plan_item_id) REFERENCES work_plan_items(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_accrual_item_method FOREIGN KEY (method_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX idx_accrual_items_batch_id ON earning_accrual_items(accrual_batch_id);
CREATE INDEX idx_accrual_items_collaborator_id ON earning_accrual_items(collaborator_id);
CREATE INDEX idx_accrual_items_status ON earning_accrual_items(status);
CREATE INDEX idx_accrual_items_work_plan_item_id ON earning_accrual_items(work_plan_item_id);

CREATE TABLE current_account_entries (
  id TEXT PRIMARY KEY,
  reverted_entry_id TEXT NULL,
  collaborator_id TEXT NOT NULL,
  entry_date DATE NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NULL,
  ledger_group_id TEXT NULL,
  method_id TEXT NULL,
  currency_code TEXT NOT NULL,
  cd_flag TEXT NOT NULL,
  item_description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  comments TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_current_account_reverted_entry FOREIGN KEY (reverted_entry_id) REFERENCES current_account_entries(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_current_account_collaborator FOREIGN KEY (collaborator_id) REFERENCES collaborator_journeys(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_current_account_method FOREIGN KEY (method_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_current_account_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX idx_current_account_collaborator_entry_date ON current_account_entries(collaborator_id, entry_date);
CREATE INDEX idx_current_account_currency_cd ON current_account_entries(currency_code, cd_flag);
CREATE INDEX idx_current_account_source ON current_account_entries(source_type, source_id);
CREATE INDEX idx_current_account_ledger_group_id ON current_account_entries(ledger_group_id);
CREATE INDEX idx_current_account_reverted_entry_id ON current_account_entries(reverted_entry_id);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT NULL,
  after_json TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE TABLE system_settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT NULL,
  updated_by TEXT NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_system_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);