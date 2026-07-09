/** Normalize header strings for comparison */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Handle duplicate headers by appending suffix */
export function deduplicateHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const normalized = header.trim() || 'column';
    const count = seen.get(normalized) ?? 0;
    seen.set(normalized, count + 1);
    return count === 0 ? normalized : `${normalized}_${count + 1}`;
  });
}

/** Header alias map for deterministic hints */
export const HEADER_ALIASES: Record<string, string[]> = {
  name: [
    'name', 'full_name', 'fullname', 'customer_name', 'client_name',
    'lead_name', 'contact_name', 'prospect_name', 'full name', 'customer',
    'contact person', 'lead name',
  ],
  email: [
    'email', 'email_address', 'mail', 'work_email', 'contact_email',
    'e_mail', 'mail_id', 'email id', 'e mail',
  ],
  mobile_without_country_code: [
    'phone', 'mobile', 'contact', 'contact_number', 'phone_number',
    'whatsapp', 'tel', 'telephone', 'cell', 'mobile_number', 'phone no',
    'phone number', 'contact no', 'contact 1', 'contact1', 'mobile no',
  ],
  company: [
    'company', 'organization', 'organisation', 'firm', 'business',
    'company_name', 'org',
  ],
  created_at: [
    'created_at', 'created', 'timestamp', 'submitted_at', 'lead_date',
    'date_created', 'submission_time', 'created_time', 'enquiry_date',
    'date', 'lead date', 'submission date',
  ],
  crm_note: [
    'note', 'notes', 'remarks', 'comment', 'comments', 'feedback',
    'follow_up_note', 'follow up', 'remarks', 'description',
  ],
  data_source: [
    'source', 'campaign', 'project', 'lead_source', 'campaign_name',
    'data source', 'lead source',
  ],
  crm_status: [
    'status', 'lead_status', 'lead_stage', 'stage', 'crm_status',
    'lead status', 'lead stage',
  ],
  lead_owner: [
    'owner', 'lead_owner', 'assigned_to', 'sales_executive', 'agent',
    'sales rep', 'assigned to', 'sales executive', 'sales person',
  ],
  city: ['city', 'town', 'location'],
  state: ['state', 'province', 'region'],
  country: ['country', 'nation'],
  possession_time: ['possession', 'possession_time', 'possession date'],
  description: ['description', 'details', 'info', 'about'],
};

import type { CrmField } from '@groeasy/shared';

export function getHeaderAliasHint(normalizedHeader: string): {
  field: CrmField;
  confidence: number;
} | null {
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalizedHeader)) {
      return { field: field as CrmField, confidence: 0.75 };
    }
    // Partial match for compound headers
    for (const alias of aliases) {
      if (normalizedHeader.includes(alias) || alias.includes(normalizedHeader)) {
        if (normalizedHeader.length >= 3 && alias.length >= 3) {
          return { field: field as CrmField, confidence: 0.55 };
        }
      }
    }
  }
  return null;
}
