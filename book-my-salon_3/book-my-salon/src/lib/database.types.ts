/**
 * Hand-authored types for the tables/RPCs the CRM UI actually touches in
 * Phase 1. This intentionally does not cover every column in
 * supabase/migrations/0001_init.sql (e.g. future booking-marketplace
 * skeleton tables aren't used by any screen yet).
 *
 * Once you have a real Supabase project running the migrations, regenerate
 * the authoritative version with:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 *
 * ...and merge in any Phase-1-specific comments you want to keep.
 */

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          name: string;
          business_type: string;
          timezone: string;
          subscription_status: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['businesses']['Row']> & { name: string };
        Update: Partial<Database['public']['Tables']['businesses']['Row']>;
      };
      branches: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          code: string;
          city: string | null;
          is_active: boolean;
        };
        Insert: Partial<Database['public']['Tables']['branches']['Row']> & { business_id: string; name: string; code: string };
        Update: Partial<Database['public']['Tables']['branches']['Row']>;
      };
      branch_payment_settings: {
        Row: {
          branch_id: string;
          business_id: string;
          upi_id: string | null;
          upi_payee_name: string | null;
          upi_enabled: boolean;
          booking_fee_paise: number;
        };
        Insert: Partial<Database['public']['Tables']['branch_payment_settings']['Row']> & { branch_id: string; business_id: string };
        Update: Partial<Database['public']['Tables']['branch_payment_settings']['Row']>;
      };
      business_memberships: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          status: string;
          all_branches: boolean;
        };
        Insert: Partial<Database['public']['Tables']['business_memberships']['Row']> & { business_id: string; user_id: string };
        Update: Partial<Database['public']['Tables']['business_memberships']['Row']>;
      };
      professional_profiles: {
        Row: {
          id: string;
          user_id: string | null;
          full_name: string;
          phone: string | null;
          gender: string | null;
          avatar_url: string | null;
        };
        Insert: Partial<Database['public']['Tables']['professional_profiles']['Row']> & { full_name: string };
        Update: Partial<Database['public']['Tables']['professional_profiles']['Row']>;
      };
      professional_employments: {
        Row: {
          id: string;
          professional_id: string;
          business_id: string;
          branch_id: string;
          job_title: string;
          status: string;
          salary_paise: number | null;
          service_commission_pct: number | null;
          product_commission_pct: number | null;
        };
        Insert: Partial<Database['public']['Tables']['professional_employments']['Row']> & {
          professional_id: string;
          business_id: string;
          branch_id: string;
        };
        Update: Partial<Database['public']['Tables']['professional_employments']['Row']>;
      };
      services: {
        Row: {
          id: string;
          business_id: string;
          category_id: string | null;
          name: string;
          duration_minutes: number;
          price_paise: number;
          tax_pct: number;
          is_active: boolean;
        };
        Insert: Partial<Database['public']['Tables']['services']['Row']> & {
          business_id: string;
          name: string;
          duration_minutes: number;
          price_paise: number;
        };
        Update: Partial<Database['public']['Tables']['services']['Row']>;
      };
      products: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          price_paise: number;
          is_active: boolean;
        };
        Insert: Partial<Database['public']['Tables']['products']['Row']> & { business_id: string; name: string; price_paise: number };
        Update: Partial<Database['public']['Tables']['products']['Row']>;
      };
      professional_services: {
        Row: { professional_id: string; service_id: string; branch_id: string };
        Insert: Database['public']['Tables']['professional_services']['Row'];
        Update: Partial<Database['public']['Tables']['professional_services']['Row']>;
      };
      business_customers: {
        Row: {
          id: string;
          business_id: string;
          normalized_phone: string;
          full_name: string | null;
          gender: string | null;
          date_of_birth: string | null;
          age_at_capture: number | null;
          profile_completed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['business_customers']['Row']> & { business_id: string; normalized_phone: string };
        Update: Partial<Database['public']['Tables']['business_customers']['Row']>;
      };
      appointments: {
        Row: {
          id: string;
          business_id: string;
          branch_id: string;
          customer_id: string;
          professional_id: string | null;
          status: string;
          booking_source: string;
          scheduled_start: string;
          actual_start: string | null;
          actual_end: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['appointments']['Row']> & { business_id: string; branch_id: string; customer_id: string };
        Update: Partial<Database['public']['Tables']['appointments']['Row']>;
      };
      appointment_services: {
        Row: {
          id: string;
          appointment_id: string;
          service_id: string;
          professional_id: string | null;
          name_snapshot: string;
          unit_price_paise: number;
          duration_minutes_snapshot: number;
          is_original: boolean;
        };
        Insert: Partial<Database['public']['Tables']['appointment_services']['Row']> & { appointment_id: string; service_id: string };
        Update: Partial<Database['public']['Tables']['appointment_services']['Row']>;
      };
      appointment_products: {
        Row: {
          id: string;
          appointment_id: string;
          product_id: string;
          name_snapshot: string;
          unit_price_paise: number;
          quantity: number;
        };
        Insert: Partial<Database['public']['Tables']['appointment_products']['Row']> & { appointment_id: string; product_id: string };
        Update: Partial<Database['public']['Tables']['appointment_products']['Row']>;
      };
      invoices: {
        Row: {
          id: string;
          business_id: string;
          branch_id: string;
          appointment_id: string | null;
          customer_id: string;
          invoice_number: string;
          subtotal_paise: number;
          discount_paise: number;
          tax_paise: number;
          booking_fee_credit_paise: number;
          total_paise: number;
          status: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['invoices']['Row']> & { business_id: string; branch_id: string; customer_id: string; invoice_number: string };
        Update: Partial<Database['public']['Tables']['invoices']['Row']>;
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          item_type: string;
          name_snapshot: string;
          unit_price_paise: number;
          quantity: number;
          tax_paise: number;
          line_total_paise: number;
          professional_id: string | null;
        };
        Insert: Partial<Database['public']['Tables']['invoice_items']['Row']> & { invoice_id: string; item_type: string; name_snapshot: string };
        Update: Partial<Database['public']['Tables']['invoice_items']['Row']>;
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string;
          amount_paise: number;
          method: string;
          confirmation_method: string;
          upi_reference: string | null;
          status: string;
          confirmed_at: string;
        };
        Insert: Partial<Database['public']['Tables']['payments']['Row']> & { invoice_id: string; amount_paise: number; method: string };
        Update: Partial<Database['public']['Tables']['payments']['Row']>;
      };
      professional_earning_entries: {
        Row: {
          id: string;
          professional_id: string;
          invoice_id: string | null;
          entry_type: string;
          amount_paise: number;
          rate_pct: number | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['professional_earning_entries']['Row']> & { professional_id: string; entry_type: string; amount_paise: number };
        Update: Partial<Database['public']['Tables']['professional_earning_entries']['Row']>;
      };
    };
    Functions: {
      create_walk_in: {
        Args: {
          p_business_id: string;
          p_branch_id: string;
          p_normalized_phone: string;
          p_professional_id: string;
          p_service_id: string;
        };
        Returns: { appointment_id: string; customer_id: string; is_new_customer: boolean }[];
      };
      complete_customer_profile: {
        Args: {
          p_customer_id: string;
          p_full_name: string | null;
          p_gender: string | null;
          p_date_of_birth: string | null;
          p_age: number | null;
        };
        Returns: void;
      };
      start_service: { Args: { p_appointment_id: string }; Returns: void };
      add_appointment_service: {
        Args: { p_appointment_id: string; p_service_id: string; p_professional_id: string | null };
        Returns: string;
      };
      add_product_to_appointment: {
        Args: { p_appointment_id: string; p_product_id: string; p_quantity: number };
        Returns: string;
      };
      complete_service: { Args: { p_appointment_id: string }; Returns: void };
      finalize_invoice: { Args: { p_appointment_id: string }; Returns: string };
      confirm_manual_payment: {
        Args: { p_invoice_id: string; p_method: string; p_upi_reference: string | null; p_idempotency_key: string };
        Returns: string;
      };
    };
  };
}
