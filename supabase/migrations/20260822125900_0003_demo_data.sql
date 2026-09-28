/*
# LifeLink – Demo data

1. Purpose
   - Populate fictional demo profiles, donors, hospitals, blood requests, matches, donations, notifications, organ-interest records, reports, and audit logs.
   - References the demo auth users created in migration 0002.
2. Safety
   - Idempotent guards prevent duplicate profiles and related records.
   - No real personal data is used.
*/

INSERT INTO public.profiles (user_id, role, full_name, email, phone, city, state, pin_code)
SELECT u.id, 'admin', 'Platform Admin', u.email, '+910000000000', 'Bengaluru', 'Karnataka', '560001'
FROM auth.users u WHERE u.email='admin@lifelink.demo'
AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=u.id);

INSERT INTO public.profiles (user_id, role, full_name, email, phone, city, state, pin_code)
SELECT u.id, 'requester', 'Rahul Mehta', u.email, '+919900000001', 'Bengaluru', 'Karnataka', '560034'
FROM auth.users u WHERE u.email='requester@lifelink.demo'
AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=u.id);

INSERT INTO public.profiles (user_id, role, full_name, email, phone, city, state, pin_code)
SELECT u.id, 'donor', d.full_name, u.email, d.phone, d.city, d.state, d.pin_code
FROM auth.users u
JOIN (VALUES
  ('donor1@lifelink.demo','Ananya Sharma','+919811100001','Bengaluru','Karnataka','560001'),
  ('donor2@lifelink.demo','Vikram Nair','+919811100002','Bengaluru','Karnataka','560002'),
  ('donor3@lifelink.demo','Priya Iyer','+919811100003','Mysuru','Karnataka','570001'),
  ('donor4@lifelink.demo','Arjun Reddy','+919811100004','Hyderabad','Telangana','500001'),
  ('donor5@lifelink.demo','Sneha Patil','+919811100005','Pune','Maharashtra','411001'),
  ('donor6@lifelink.demo','Karan Singh','+919811100006','Delhi','Delhi','110001')
) AS d(email, full_name, phone, city, state, pin_code) ON u.email=d.email
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=u.id);

INSERT INTO public.profiles (user_id, role, full_name, email, phone, city, state, pin_code)
SELECT u.id, 'hospital', h.full_name, u.email, h.phone, h.city, h.state, h.pin_code
FROM auth.users u
JOIN (VALUES
  ('hospital@lifelink.demo','City Care Hospital','+918040000001','Bengaluru','Karnataka','560001'),
  ('hospital2@lifelink.demo','Metro Multi-Speciality','+918040000002','Hyderabad','Telangana','500001')
) AS h(email, full_name, phone, city, state, pin_code) ON u.email=h.email
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=u.id);

INSERT INTO public.donor_profiles (user_id, blood_group, date_of_birth, gender, last_donation_date, available, emergency_available, verified, consent_to_contact, organ_donation_interest, preferred_contact_method)
SELECT u.id, d.blood_group, d.date_of_birth::date, d.gender, d.last_donation_date::date, d.available, d.emergency_available, d.verified, true, d.organ_donation_interest, d.preferred_contact_method
FROM auth.users u
JOIN (VALUES
  ('donor1@lifelink.demo','O+','1995-04-12','female','2024-09-01',true,true,true,true,'phone'),
  ('donor2@lifelink.demo','B+','1990-06-23','male','2024-11-15',true,false,true,false,'app'),
  ('donor3@lifelink.demo','A+','1992-02-02','female','2025-01-10',true,true,false,true,'phone'),
  ('donor4@lifelink.demo','AB+','1988-12-30','male','2024-07-20',false,false,true,false,'email'),
  ('donor5@lifelink.demo','O-','1997-08-08','female','2025-02-05',true,true,true,true,'phone'),
  ('donor6@lifelink.demo','A-','1993-03-15','male','2024-10-01',true,false,false,false,'app')
) AS d(email, blood_group, date_of_birth, gender, last_donation_date, available, emergency_available, verified, organ_donation_interest, preferred_contact_method) ON u.email=d.email
WHERE NOT EXISTS (SELECT 1 FROM public.donor_profiles dp WHERE dp.user_id=u.id);

INSERT INTO public.hospitals (user_id, hospital_name, registration_number, address, city, state, pin_code, phone, verification_status, verified_at)
SELECT u.id, h.hospital_name, h.registration_number, h.address, h.city, h.state, h.pin_code, h.phone, h.verification_status, h.verified_at::timestamptz
FROM auth.users u
JOIN (VALUES
  ('hospital@lifelink.demo','City Care Hospital','KAR-HC-001','MG Road, Bengaluru','Bengaluru','Karnataka','560001','+918040000001','verified','2025-01-01'),
  ('hospital2@lifelink.demo','Metro Multi-Speciality','TS-HC-002','Banjara Hills, Hyderabad','Hyderabad','Telangana','500001','+918040000002','pending',NULL)
) AS h(email, hospital_name, registration_number, address, city, state, pin_code, phone, verification_status, verified_at) ON u.email=h.email
WHERE NOT EXISTS (SELECT 1 FROM public.hospitals hp WHERE hp.user_id=u.id);

DO $$
DECLARE v_requester uuid; v_hospital uuid; v_request uuid; v_donor1 uuid; v_donor2 uuid; v_donor3 uuid; v_admin uuid; v_donor5 uuid; v_target uuid;
BEGIN
  SELECT user_id INTO v_requester FROM public.profiles WHERE email='requester@lifelink.demo';
  SELECT id INTO v_hospital FROM public.hospitals WHERE hospital_name='City Care Hospital';
  SELECT user_id INTO v_donor1 FROM public.profiles WHERE email='donor1@lifelink.demo';
  SELECT user_id INTO v_donor2 FROM public.profiles WHERE email='donor2@lifelink.demo';
  SELECT user_id INTO v_donor3 FROM public.profiles WHERE email='donor3@lifelink.demo';
  SELECT user_id INTO v_donor5 FROM public.profiles WHERE email='donor5@lifelink.demo';
  SELECT user_id INTO v_admin FROM public.profiles WHERE email='admin@lifelink.demo';
  SELECT user_id INTO v_target FROM public.profiles WHERE email='donor6@lifelink.demo';

  IF NOT EXISTS (SELECT 1 FROM public.blood_requests WHERE requester_id=v_requester AND blood_group='O+' AND status='matching') THEN
    INSERT INTO public.blood_requests (requester_id,hospital_id,blood_group,units_required,urgency,required_date,required_time,patient_reference,location,notes,status,expires_at)
    VALUES (v_requester,v_hospital,'O+',2,'urgent',CURRENT_DATE+3,'14:00','Patient R-104','Bengaluru','Post-surgery requirement','matching',CURRENT_DATE+7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.blood_requests WHERE requester_id=v_requester AND blood_group='AB+' AND status='fulfilled') THEN
    INSERT INTO public.blood_requests (requester_id,hospital_id,blood_group,units_required,urgency,required_date,required_time,patient_reference,location,notes,status,expires_at)
    VALUES (v_requester,v_hospital,'AB+',1,'normal',CURRENT_DATE-10,'10:00','Patient R-088','Bengaluru','Routine transfusion','fulfilled',CURRENT_DATE-5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.blood_requests WHERE requester_id=v_requester AND urgency='emergency' AND status='donors_contacted') THEN
    INSERT INTO public.blood_requests (requester_id,hospital_id,blood_group,units_required,urgency,required_date,required_time,patient_reference,location,notes,status,expires_at)
    VALUES (v_requester,v_hospital,'B+',3,'emergency',CURRENT_DATE,'18:00','Patient R-119 (ICU)','Bengaluru','Emergency: accident victim','donors_contacted',CURRENT_DATE+2);
  END IF;

  SELECT id INTO v_request FROM public.blood_requests WHERE requester_id=v_requester AND blood_group='O+' AND status='matching' LIMIT 1;
  IF v_request IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.donor_matches WHERE request_id=v_request) THEN
    INSERT INTO public.donor_matches (request_id,donor_id,match_score,status,factors) VALUES
      (v_request,v_donor1,96,'accepted','{"blood_compatibility":true,"availability":true,"emergency":true,"verified":true,"distance":"same_city"}'::jsonb),
      (v_request,v_donor5,92,'pending','{"blood_compatibility":true,"availability":true,"emergency":true,"verified":true,"distance":"different_state"}'::jsonb),
      (v_request,v_donor3,78,'pending','{"blood_compatibility":true,"availability":true,"emergency":false,"verified":false,"distance":"same_state"}'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.donations WHERE donor_id=v_donor1) THEN
    INSERT INTO public.donations (donor_id,request_id,hospital_id,donation_date,donation_type,status)
    SELECT v_donor1,id,v_hospital,CURRENT_DATE-10,'blood','completed' FROM public.blood_requests WHERE requester_id=v_requester AND status='fulfilled' LIMIT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id=v_requester) THEN
    INSERT INTO public.notifications (user_id,title,message,type,read,link) VALUES
      (v_requester,'Donor accepted your request','Ananya accepted your O+ blood request.','donor_response',false,'/requests'),
      (v_requester,'Emergency request broadcast','Your emergency B+ request was sent to nearby donors.','emergency',false,'/requests');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id=v_donor1) THEN
    INSERT INTO public.notifications (user_id,title,message,type,read,link) VALUES
      (v_donor1,'New blood request nearby','O+ blood needed in Bengaluru (urgent).','request',false,'/donor/requests'),
      (v_donor1,'Profile verified','Your donor profile is now verified.','verification',true,'/donor');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id=v_donor2) THEN
    INSERT INTO public.notifications (user_id,title,message,type,read,link) VALUES (v_donor2,'New blood request nearby','O+ blood needed in Bengaluru.','request',false,'/donor/requests');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organ_donation_interest WHERE user_id=v_donor1) THEN
    INSERT INTO public.organ_donation_interest (user_id,interest_status,organ_preferences,consent,notes) VALUES (v_donor1,'interested','["kidney","liver"]'::jsonb,true,'Willing to donate after death.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organ_donation_interest WHERE user_id=v_donor5) THEN
    INSERT INTO public.organ_donation_interest (user_id,interest_status,organ_preferences,consent,notes) VALUES (v_donor5,'interested','["cornea","heart"]'::jsonb,true,'Registered interest for awareness.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reports WHERE reporter_id=v_requester) THEN
    INSERT INTO public.reports (reporter_id,reported_user_id,reason,description,status) VALUES (v_requester,v_target,'suspicious_profile','Profile seems incomplete and inactive for a long time.','open');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE public.audit_logs.admin_id=v_admin) THEN
    INSERT INTO public.audit_logs (admin_id,action,target_type,details) VALUES (v_admin,'verify_hospital','hospital','{"hospital":"City Care Hospital"}'::jsonb);
  END IF;
END $$;
