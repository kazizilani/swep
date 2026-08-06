-- Drop existing tables
DROP TABLE IF EXISTS check_ins CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS desks CASCADE;
DROP TABLE IF EXISTS floor_maps CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Store
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'EMPLOYEE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Floor Maps
CREATE TABLE floor_maps (
    floor_id SERIAL PRIMARY KEY,
    floor_number VARCHAR(10) NOT NULL,
    building_name VARCHAR(50) NOT NULL,
    total_capacity INT DEFAULT 20
);

-- Desk Inventory Store
CREATE TABLE desks (
    desk_id SERIAL PRIMARY KEY,
    floor_id INT REFERENCES floor_maps(floor_id) ON DELETE CASCADE,
    desk_code VARCHAR(20) UNIQUE NOT NULL,
    has_monitor BOOLEAN DEFAULT TRUE,
    is_accessible BOOLEAN DEFAULT TRUE
);

-- Bookings Store
CREATE TABLE bookings (
    booking_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    desk_id INT REFERENCES desks(desk_id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'CONFIRMED',
    qr_token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Check-ins Verification Store
CREATE TABLE check_ins (
    checkin_id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bookings(booking_id) ON DELETE CASCADE,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    terminal_id VARCHAR(50) DEFAULT 'TERM-ENTRANCE-01',
    verification_passed BOOLEAN DEFAULT TRUE
);

-- Seed Initial Data
INSERT INTO users (full_name, email, password_hash, role) VALUES
('Jane Doe', 'jane@deskspot.com', 'hashed_pwd_123', 'EMPLOYEE'),
('Admin User', 'admin@deskspot.com', 'hashed_pwd_admin', 'FACILITY_MANAGER');

INSERT INTO floor_maps (floor_number, building_name, total_capacity) VALUES
('Floor 3', 'Tech Tower HQ', 6);

INSERT INTO desks (floor_id, desk_code, has_monitor, is_accessible) VALUES
(1, 'D-301', true, true),
(1, 'D-302', true, false),
(1, 'D-303', false, true),
(1, 'D-304', true, true),
(1, 'D-305', true, false),
(1, 'D-306', false, false);
