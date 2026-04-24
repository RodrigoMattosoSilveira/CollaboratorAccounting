INSERT OR IGNORE INTO reference_data (id,type,code,label,description,active,sort_order,metadata_json,created_at,updated_at) VALUES
('ref-person-status-active','person_status','ACTIVE','Active','Currently under contract',1,10,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('ref-person-status-inactive','person_status','INACTIVE','Inactive','Out of contract but eligible to return',1,20,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('ref-person-status-discontinued','person_status','DISCONTINUED','Discontinued','Out of contract and not expected to return',1,30,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('ref-method-daily-wages','method','DAILY_WAGES','Daily Wages','Paid per day in BRL',1,10,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('ref-method-salary','method','SALARY','Salary','Paid monthly in BRL',1,20,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('ref-method-commission','method','COMMISSION','Commission','Paid in grams of gold based on production',1,30,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('ref-currency-brl','ledger_currency','BRL','Real',NULL,1,10,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('ref-currency-gold','ledger_currency','GOLD_GRAMS','Gold Grams',NULL,1,20,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
