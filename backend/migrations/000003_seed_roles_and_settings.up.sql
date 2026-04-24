INSERT INTO roles (id, code, label, created_at, updated_at) VALUES
('role-admin', 'ADMIN', 'Administrator', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('role-planner', 'PLANNER', 'Planner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('role-mercantile-operator', 'MERCANTILE_OPERATOR', 'Mercantile Operator', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('role-finance-viewer', 'FINANCE_VIEWER', 'Finance Viewer', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- These assume a bootstrap admin user will be created before or separately.
-- If not, replace 'bootstrap-admin-user-id' after user creation.
INSERT INTO system_settings (id, key, value, description, updated_by, updated_at) VALUES
('setting-journey-default-days', 'journey_default_days', '90', 'Default collaborator journey length in days', 'bootstrap-admin-user-id', CURRENT_TIMESTAMP),
('setting-return-wait-days', 'return_wait_days', '30', 'Minimum wait between journeys', 'bootstrap-admin-user-id', CURRENT_TIMESTAMP),
('setting-salary-daily-divisor', 'salary_daily_divisor', '30', 'Divisor used to normalize monthly salary into daily accrual', 'bootstrap-admin-user-id', CURRENT_TIMESTAMP),
('setting-max-sick-days', 'max_sick_days', '3', 'Maximum sick days allowed for commissioned collaborator rules', 'bootstrap-admin-user-id', CURRENT_TIMESTAMP),
('setting-commission-projection-basis', 'commission_projection_basis', 'rolling_average', 'How projected commission is estimated', 'bootstrap-admin-user-id', CURRENT_TIMESTAMP);