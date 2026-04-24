DELETE FROM reference_data WHERE type IN (
  'person_status',
  'collaborator_status',
  'method',
  'sector',
  'location',
  'task',
  'expense_category',
  'ledger_currency',
  'ledger_cd_flag',
  'period_code'
);