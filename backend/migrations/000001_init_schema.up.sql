PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS reference_data (
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_reference_data_type_code ON reference_data(type, code);
CREATE INDEX IF NOT EXISTS idx_reference_data_type_active_sort ON reference_data(type, active, sort_order);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  address TEXT NULL,
  phone TEXT NULL UNIQUE,
  email TEXT NULL UNIQUE,
  cpf TEXT NULL UNIQUE,
  bank_data TEXT NULL,
  pix_key TEXT NULL UNIQUE,
  emergency_contact_name TEXT NULL,
  emergency_contact_phone TEXT NULL,
  emergency_contact_notes TEXT NULL,
  status_id TEXT NOT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (status_id) REFERENCES reference_data(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
