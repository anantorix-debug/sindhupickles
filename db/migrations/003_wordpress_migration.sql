-- Additive: SEO metadata carried over from Rank Math, and the old-to-new identifier map.
-- New tables only; nothing existing is altered.
CREATE TABLE IF NOT EXISTS product_seo (
  product_id       BIGINT UNSIGNED NOT NULL,
  meta_title       VARCHAR(255) NULL,
  meta_description VARCHAR(500) NULL,
  PRIMARY KEY (product_id),
  CONSTRAINT fk_product_seo_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wp_import_map (
  wp_id      BIGINT UNSIGNED NOT NULL,
  wp_type    VARCHAR(24) NOT NULL,
  wp_slug    VARCHAR(190) NOT NULL,
  wp_url     VARCHAR(500) NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  imported_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (wp_type, wp_id),
  KEY idx_wp_import_product (product_id),
  CONSTRAINT fk_wp_import_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Newsletter sign-ups from the storefront footer band (the old site had a subscribe form via Jetpack).
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email      VARCHAR(190) NOT NULL,
  source     VARCHAR(40) NOT NULL DEFAULT 'storefront',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_newsletter_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
