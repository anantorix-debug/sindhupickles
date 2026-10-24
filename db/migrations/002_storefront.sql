-- Additive migration for the public storefront. New tables only; nothing existing is altered.

-- Customer sign-in. `customers` has no password column, and admin users (`users`) are a
-- separate table, so customers get their own credentials. Dependent rows belong to the
-- customer, so they are removed with the customer.
CREATE TABLE IF NOT EXISTS customer_credentials (
  customer_id   BIGINT UNSIGNED NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  preferences   JSON NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (customer_id),
  CONSTRAINT fk_credentials_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Only a SHA-256 of the emailed token is stored.
CREATE TABLE IF NOT EXISTS password_resets (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64) NOT NULL,
  expires_at  DATETIME(3) NOT NULL,
  used_at     DATETIME(3) NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_resets_token (token_hash),
  KEY idx_password_resets_customer (customer_id),
  CONSTRAINT fk_resets_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The storefront address form has "Area / Locality" and "District", which the existing
-- `addresses` table has no columns for. They live here so `addresses` stays untouched.
CREATE TABLE IF NOT EXISTS address_details (
  address_id BIGINT UNSIGNED NOT NULL,
  area       VARCHAR(120) NULL,
  district   VARCHAR(120) NULL,
  PRIMARY KEY (address_id),
  CONSTRAINT fk_address_details_address FOREIGN KEY (address_id) REFERENCES addresses (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
