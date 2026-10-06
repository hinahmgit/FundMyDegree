-- Demo universities for local development (loaded by `supabase db reset`).
-- Bank details are fictional.
insert into public.universities
  (name, country_code, city, website, fee_currency, status, accreditation_body,
   bank_name, bank_account_name, iban, bank_account_number, swift_bic, payment_portal_url,
   payment_reference_instructions, finance_contact_name, finance_contact_email)
values
  ('University of Nairobi (demo)', 'KE', 'Nairobi', 'https://www.uonbi.ac.ke', 'KES', 'approved', 'Commission for University Education',
   'Demo Commercial Bank', 'University Fees Account', null, '0011223344', 'DEMOKENX', null,
   'Use the student registration number as the reference.', 'Finance Office', 'finance@example.ac.ke'),
  ('University of Lagos (demo)', 'NG', 'Lagos', 'https://unilag.edu.ng', 'NGN', 'approved', 'National Universities Commission',
   'Demo Bank Nigeria', 'UNILAG Tuition', null, '1234567890', 'DEMONGLA', null,
   'Reference: matric number and invoice number.', 'Bursary', 'bursary@example.edu.ng'),
  ('Lahore University (demo)', 'PK', 'Lahore', null, 'PKR', 'approved', 'Higher Education Commission',
   'Demo Bank Pakistan', 'Lahore University Fees', 'PK36DEMO0000001123456702', null, 'DEMOPKKA', null,
   null, 'Accounts Office', 'accounts@example.edu.pk'),
  ('Universidad de Bogotá (demo)', 'CO', 'Bogotá', null, 'COP', 'approved', 'Ministerio de Educación Nacional',
   'Banco Demo', 'Universidad Matrículas', null, '000123456789', 'DEMOCOBB', 'https://pagos.example.edu.co',
   null, 'Tesorería', 'tesoreria@example.edu.co')
on conflict do nothing;
