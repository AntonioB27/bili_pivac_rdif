-- Admin users are web-only and don't need an RFID card
ALTER TABLE employees ALTER COLUMN rfid_uid DROP NOT NULL;

-- Still require rfid_uid for employees who clock in physically
ALTER TABLE employees ADD CONSTRAINT rfid_uid_required_for_employees
  CHECK (role = 'admin' OR rfid_uid IS NOT NULL);
