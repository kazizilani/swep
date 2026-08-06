const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Database Pool Connection Configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:secret@localhost:5432/deskspot',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// UC-1: Authenticate User API Mock
app.post('/api/v1/auth/login', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// UC-2: Search Available Desks & Query Inventory
app.get('/api/v1/desks', async (req, res) => {
  const { startTime, endTime } = req.query;
  try {
    const query = `
      SELECT d.*, 
        CASE WHEN b.booking_id IS NOT NULL THEN FALSE ELSE TRUE END AS is_available
      FROM desks d
      LEFT JOIN bookings b ON d.desk_id = b.desk_id 
        AND b.status IN ('CONFIRMED', 'CHECKED_IN')
        AND b.start_time < $2 AND b.end_time > $1
    `;
    const result = await pool.query(query, [startTime || '1970-01-01', endTime || '2099-01-01']);
    return res.json({ success: true, desks: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// UC-3 & Sequence Diagram: Reserve Workspace (Pessimistic Locking Engine)
app.post('/api/v1/bookings', async (req, res) => {
  const { userId, deskId, startTime, endTime } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Acquire Row-Level Lock on Target Desk
    const lockCheck = await client.query(
      'SELECT desk_id FROM desks WHERE desk_id = $1 FOR UPDATE',
      [deskId]
    );

    if (lockCheck.rows.length === 0) {
      throw { status: 404, message: 'Desk not found' };
    }

    // Check for Collisions
    const conflictCheck = await client.query(
      `SELECT booking_id FROM bookings 
       WHERE desk_id = $1 AND status IN ('CONFIRMED', 'CHECKED_IN') 
       AND start_time < $2 AND end_time > $3 LIMIT 1`,
      [deskId, endTime, startTime]
    );

    if (conflictCheck.rows.length > 0) {
      throw { status: 409, message: 'Slot already taken by another request.' };
    }

    // Generate Token & Create Record
    const qrToken = `DS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const insertRes = await client.query(
      `INSERT INTO bookings (user_id, desk_id, start_time, end_time, status, qr_token)
       VALUES ($1, $2, $3, $4, 'CONFIRMED', $5) RETURNING *`,
      [userId, deskId, startTime, endTime, qrToken]
    );

    await client.query('COMMIT');
    return res.status(201).json({ success: true, booking: insertRes.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(err.status || 500).json({ success: false, message: err.message || err.toString() });
  } finally {
    client.release();
  }
});

// UC-4: Check-in Workspace API
app.post('/api/v1/checkin', async (req, res) => {
  const { qrToken } = req.body;
  try {
    const bookingRes = await pool.query('SELECT * FROM bookings WHERE qr_token = $1', [qrToken]);
    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid QR Pass' });
    }

    const booking = bookingRes.rows[0];
    await pool.query('UPDATE bookings SET status = $1 WHERE booking_id = $2', ['CHECKED_IN', booking.booking_id]);
    await pool.query('INSERT INTO check_ins (booking_id) VALUES ($1)', [booking.booking_id]);

    return res.json({ success: true, message: 'Check-in successful! Workspace unlocked.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch Bookings History
app.get('/api/v1/bookings/user/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, d.desk_code FROM bookings b 
       JOIN desks d ON b.desk_id = d.desk_id 
       WHERE b.user_id = $1 ORDER BY b.created_at DESC`,
      [req.params.userId]
    );
    return res.json({ success: true, bookings: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DeskSpot Server active on port ${PORT}`));
