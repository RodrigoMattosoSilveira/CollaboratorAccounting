PRAGMA foreign_keys = OFF;

ALTER TABLE people RENAME TO people_old;

CREATE TABLE people (
  id TEXT PRIMARY KEY,

  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nickname TEXT NOT NULL,

  cpf TEXT NOT NULL,
  rg TEXT NOT NULL,
  cellular TEXT NOT NULL,
  email TEXT NOT NULL,

  street1 TEXT NULL,
  street2 TEXT NULL,
  state TEXT NULL,
  cep TEXT NULL,
  city TEXT NULL,
  country TEXT NOT NULL DEFAULT 'Brasil',

  bank_name TEXT NULL,
  bank_number TEXT NULL,
  checking_account TEXT NULL,
  pix_key TEXT NULL,

  emergency_name TEXT NULL,
  emergency_cellular TEXT NULL,
  emergency_email TEXT NULL,

  profile_completion_status TEXT NOT NULL DEFAULT 'PERSONAL_ONLY',
  can_create_collaborator INTEGER NOT NULL DEFAULT 0,

  status_id TEXT NOT NULL,
  notes TEXT NULL,

  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,

  CONSTRAINT fk_people_status
    FOREIGN KEY (status_id)
    REFERENCES reference_data(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX ux_people_cpf ON people(cpf);
CREATE UNIQUE INDEX ux_people_rg ON people(rg);
CREATE UNIQUE INDEX ux_people_cellular ON people(cellular);
CREATE UNIQUE INDEX ux_people_email ON people(email);
CREATE UNIQUE INDEX ux_people_pix_key ON people(pix_key) WHERE pix_key IS NOT NULL;

CREATE INDEX idx_people_status_id ON people(status_id);
CREATE INDEX idx_people_profile_completion_status ON people(profile_completion_status);
CREATE INDEX idx_people_can_create_collaborator ON people(can_create_collaborator);

DROP TABLE people_old;

PRAGMA foreign_keys = ON;