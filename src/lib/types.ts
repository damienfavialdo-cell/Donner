export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  max_members: number;
  created_at: string;
  updated_at: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export type PersonCategory = 'beneficiary' | 'child' | 'mother' | 'visitor' | 'staff';

export interface Person {
  id: string;
  tenant_id: string;
  category: PersonCategory;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  barcode_id: string;
  qr_code: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  photo_url: string;
  notes: string;
  active: boolean;
  salary: number;
  position: string;
  contract_type: string;
  created_at: string;
  updated_at: string;
}

export interface Badge {
  id: string;
  tenant_id: string;
  person_id: string;
  barcode_data: string;
  qr_data: string | null;
  pdf_url: string | null;
  generated_at: string;
  regenerated_at: string | null;
}

export interface Event {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  location: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  tenant_id: string;
  member_id: string | null;
  person_id: string | null;
  event_id: string | null;
  direction: 'entry' | 'exit';
  scanned_at: string;
  scanned_by: string | null;
  notes: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: 'scan' | 'system' | 'event';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  tenant_id: string;
  title: string;
  report_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  date_from: string | null;
  date_to: string | null;
  format: 'pdf' | 'excel' | 'doc';
  file_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EventParticipant {
  id: string;
  tenant_id: string;
  event_id: string;
  person_id: string;
  created_at: string;
}

export interface Member {
  id: string;
  tenant_id: string;
  barcode_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScanResult {
  success: boolean;
  direction: 'entry' | 'exit';
  message: string;
  person?: {
    first_name: string;
    last_name: string;
    barcode_id: string;
    category: string;
  };
}

export interface PresenceRecord {
  id: string;
  tenant_id: string;
  person_id: string;
  event_id: string | null;
  status: 'present' | 'absent' | 'retard';
  group_name: string;
  presence_date: string;
  check_in_time: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export interface SuiviPersonnel {
  id: string;
  tenant_id: string;
  person_id: string;
  position: string;
  department: string;
  contract_type: string;
  contract_start: string | null;
  contract_end: string | null;
  salary: number;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuiviMere {
  id: string;
  tenant_id: string;
  person_id: string;
  prenatal_date: string | null;
  postnatal_date: string | null;
  number_of_children: number;
  health_status: string;
  support_type: string;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuiviEnfant {
  id: string;
  tenant_id: string;
  person_id: string;
  school_level: string;
  health_status: string;
  nutrition_status: string;
  guardian_name: string;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuiviBeneficiaire {
  id: string;
  tenant_id: string;
  person_id: string;
  program: string;
  aid_type: string;
  amount: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuiviSalaire {
  id: string;
  tenant_id: string;
  person_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  month: string;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export interface SuiviMedicament {
  id: string;
  tenant_id: string;
  person_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  start_date: string | null;
  end_date: string | null;
  prescribed_by: string;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuiviCantine {
  id: string;
  tenant_id: string;
  person_id: string;
  meal_count: number;
  nutrition_status: string;
  meal_type: string;
  tracking_date: string;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export interface SuiviGargote {
  id: string;
  tenant_id: string;
  person_id: string;
  activity: string;
  participation_count: number;
  tracking_date: string;
  notes: string;
  created_by: string | null;
  created_at: string;
}


