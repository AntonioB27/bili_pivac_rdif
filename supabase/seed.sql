-- Admin korisnik za lokalni razvoj
-- username: admin | password: admin123
-- Lozinka se mijenja pri produkcijskom deployu

INSERT INTO auth.users (
  id, instance_id, email, aud, role, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@rfid-bp.local',
  'authenticated',
  'authenticated',
  crypt('admin123', gen_salt('bf')),
  now(),
  '', '', '', '',
  '{"provider": "email", "providers": ["email"]}',
  '{"email_verified": true}',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Identity row required by Supabase Auth for email/password login.
-- provider_id must be the user UUID (not the email) in GoTrue v2.
INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'email',
  '{"sub": "00000000-0000-0000-0000-000000000001", "email": "admin@rfid-bp.local", "email_verified": true, "phone_verified": false}',
  now(),
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, ime_prezime, rfid_uid, username, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Administrator',
  'ADMIN-RFID-0001',
  'admin',
  'admin'
)
ON CONFLICT (id) DO NOTHING;
