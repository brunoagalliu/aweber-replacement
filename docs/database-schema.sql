-- AWeber Replacement Database Schema
-- Version: 1.0
-- Description: Complete database schema for email list management

CREATE DATABASE IF NOT EXISTS aweber;
USE aweber;

-- Lists table
CREATE TABLE lists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subscribers table with ALL fields
CREATE TABLE subscribers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  phone VARCHAR(20),
  date_added DATETIME,
  stop_time DATETIME,
  stop_status INT DEFAULT 0,
  misc TEXT,
  ad_tracking VARCHAR(255),
  ip_address VARCHAR(45),
  web_form_url TEXT,
  country VARCHAR(100),
  region VARCHAR(100),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  dma_code VARCHAR(10),
  area_code VARCHAR(10),
  tags TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_date_added (date_added),
  INDEX idx_stop_status (stop_status),
  INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Junction table for many-to-many relationship
CREATE TABLE list_subscribers (
  list_id INT NOT NULL,
  subscriber_id INT NOT NULL,
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, subscriber_id),
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE,
  INDEX idx_list (list_id),
  INDEX idx_subscriber (subscriber_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;