-- Person Status
INSERT INTO reference_data (id, type, code, label, description, active, sort_order, metadata_json, created_at, updated_at) VALUES
('ref-person-status-active', 'person_status', 'ACTIVE', 'Active', 'Currently under contract', 1, 10, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-person-status-inactive', 'person_status', 'INACTIVE', 'Inactive', 'Out of contract but eligible to return', 1, 20, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-person-status-discontinued', 'person_status', 'DISCONTINUED', 'Discontinued', 'Out of contract and not expected to return', 1, 30, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Collaborator Status
INSERT INTO reference_data (id, type, code, label, description, active, sort_order, metadata_json, created_at, updated_at) VALUES
('ref-collab-status-active', 'collaborator_status', 'ACTIVE', 'Active', 'Available to planning', 1, 10, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-collab-status-sick', 'collaborator_status', 'SICK', 'Sick', 'Took a sick day', 1, 20, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-collab-status-license', 'collaborator_status', 'LICENSE', 'License', 'On leave of absence', 1, 30, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-collab-status-finished', 'collaborator_status', 'FINISHED', 'Finished', 'Journey is finished', 1, 40, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Methods
INSERT INTO reference_data (id, type, code, label, description, active, sort_order, metadata_json, created_at, updated_at) VALUES
('ref-method-daily-wages', 'method', 'DAILY_WAGES', 'Daily Wages', 'Paid per day in BRL', 1, 10, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-method-salary', 'method', 'SALARY', 'Salary', 'Paid monthly in BRL', 1, 20, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-method-commission', 'method', 'COMMISSION', 'Commission', 'Paid in grams of gold based on production', 1, 30, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Sectors
INSERT INTO reference_data (id, type, code, label, description, active, sort_order, metadata_json, created_at, updated_at) VALUES
('ref-sector-mine', 'sector', 'MINE', 'Mine', NULL, 1, 10, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-sector-office', 'sector', 'OFFICE', 'Office', NULL, 1, 20, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-sector-canteen', 'sector', 'CANTEEN', 'Canteen', NULL, 1, 30, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-sector-mill', 'sector', 'MILL', 'Mill', NULL, 1, 40, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Locations
INSERT INTO reference_data (id, type, code, label, description, active, sort_order, metadata_json, created_at, updated_at) VALUES
('ref-location-well-1', 'location', 'WELL_1', 'well 1', NULL, 1, 10, '{"mineWell":true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-location-well-2', 'location', 'WELL_2', 'well 2', NULL, 1, 20, '{"mineWell":true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-location-well-3', 'location', 'WELL_3', 'well 3', NULL, 1, 30, '{"mineWell":true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-location-office', 'location', 'OFFICE', 'office', NULL, 1, 40, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-location-burn-house', 'location', 'BURN_HOUSE', 'burn house', NULL, 1, 50, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-location-vault-house', 'location', 'VAULT_HOUSE', 'vault house', NULL, 1, 60, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-location-canteen', 'location', 'CANTEEN', 'canteen', NULL, 1, 70, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-location-warehouse', 'location', 'WAREHOUSE', 'warehouse', NULL, 1, 80, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Tasks
INSERT INTO reference_data (id, type, code, label, description, active, sort_order, metadata_json, created_at, updated_at) VALUES
('ref-task-administrador', 'task', 'ADMINISTRADOR', 'Administrador', NULL, 1, 10, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-ajudante', 'task', 'AJUDANTE', 'Ajudante', NULL, 1, 20, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-boroquiero', 'task', 'BOROQUIERO', 'Boroquiero', NULL, 1, 30, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-britador', 'task', 'BRITADOR', 'Britador', NULL, 1, 40, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-cozinheiro', 'task', 'COZINHEIRO', 'Cozinheiro', NULL, 1, 50, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-guincheiro', 'task', 'GUINCHEIRO', 'Guincheiro', NULL, 1, 60, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-jeriqueiro', 'task', 'JERIQUEIRO', 'Jeriqueiro', NULL, 1, 70, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-madeirador', 'task', 'MADEIRADOR', 'Madeirador', NULL, 1, 80, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-moinho', 'task', 'MOINHO', 'Moinho', NULL, 1, 90, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-poco', 'task', 'POCO', 'Poço', NULL, 1, 100, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-quebrador-pedra', 'task', 'QUEBRADOR_PEDRA', 'Quebrador Pedra', NULL, 1, 110, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-serrador', 'task', 'SERRADOR', 'Serrador', NULL, 1, 120, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-servicos-gerais', 'task', 'SERVICOS_GERAIS', 'Servicos Gerais', NULL, 1, 130, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-task-tratorista', 'task', 'TRATORISTA', 'Tratorista', NULL, 1, 140, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Expense Categories
INSERT INTO reference_data (id, type, code, label, description, active, sort_order, metadata_json, created_at, updated_at) VALUES
('ref-expense-canteen', 'expense_category', 'CANTEEN', 'Canteen', NULL, 1, 10, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-expense-pix', 'expense_category', 'PIX', 'PIX', 'Always in BRL', 1, 20, '{"brlOnly":true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-expense-flights', 'expense_category', 'FLIGHTS', 'Flights', NULL, 1, 30, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-expense-pay-daily-wager', 'expense_category', 'PAY_DAILY_WAGER', 'Pay Daily Wager', NULL, 1, 40, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-expense-diverse', 'expense_category', 'DIVERSE', 'Diverse', NULL, 1, 50, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Ledger Currency
INSERT INTO reference_data (id, type, code, label, description, active, sort_order, metadata_json, created_at, updated_at) VALUES
('ref-currency-brl', 'ledger_currency', 'BRL', 'Real', NULL, 1, 10, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-currency-gold', 'ledger_currency', 'GOLD_GRAMS', 'Gold Grams', NULL, 1, 20, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Ledger C/D
INSERT INTO reference_data (id, type, code, label, description, active, sort_order, metadata_json, created_at, updated_at) VALUES
('ref-cd-credit', 'ledger_cd_flag', 'CREDIT', 'Credit', NULL, 1, 10, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-cd-debit', 'ledger_cd_flag', 'DEBIT', 'Debit', NULL, 1, 20, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Period codes
INSERT INTO reference_data (id, type, code, label, description, active, sort_order, metadata_json, created_at, updated_at) VALUES
('ref-period-day', 'period_code', 'DAY', 'Day', '12-hour day shift', 1, 10, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ref-period-night', 'period_code', 'NIGHT', 'Night', '12-hour night shift', 1, 20, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
