export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export type Database = {
  // These tables moved from the Departure project's `public` schema into the intranet
  // project's `pre_departure` schema. The key must match the `db.schema` set in
  // createServiceClient, or supabase-js rejects every table name at compile time.
  pre_departure: {
    Tables: {
      profiles: {
        Row: {
          id: string
          auth_id: string | null
          full_name: string | null
          email: string
          role: "super_admin" | "admin" | "user"
          department: string | null
          status: "active" | "pending"
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          auth_id?: string | null
          full_name?: string | null
          email: string
          role?: "super_admin" | "admin" | "user"
          department?: string | null
          status?: "active" | "pending"
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          auth_id?: string | null
          full_name?: string | null
          email?: string
          role?: "super_admin" | "admin" | "user"
          department?: string | null
          status?: "active" | "pending"
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: string
          role: "admin" | "user"
          action: string
          allowed: boolean
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          role: "admin" | "user"
          action: string
          allowed?: boolean
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          role?: "admin" | "user"
          action?: string
          allowed?: boolean
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      PNR_Note: {
        Row: {
          PNR: string
          Notes: string
          Note_By: string
          Created_at: string
          "Updated at": string | null
        }
        Insert: {
          PNR: string
          Notes: string
          Note_By: string
          Created_at?: string
          "Updated at"?: string | null
        }
        Update: {
          PNR?: string
          Notes?: string
          Note_By?: string
          Created_at?: string
          "Updated at"?: string | null
        }
        Relationships: []
      }
      PNR_Report_IT: {
        Row: {
          id: number
          PNR: string
          JSON: Json | null
          Status: string | null
          reason: string | null
          reported_by: string | null
          reported_on: string | null
          created_at: string
        }
        Insert: {
          id?: number
          PNR: string
          JSON?: Json | null
          Status?: string | null
          reason?: string | null
          reported_by?: string | null
          reported_on?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          PNR?: string
          JSON?: Json | null
          Status?: string | null
          reason?: string | null
          reported_by?: string | null
          reported_on?: string | null
          created_at?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          id: number
          code: string
          created_at: string | null
        }
        Insert: {
          id?: number
          code: string
          created_at?: string | null
        }
        Update: {
          id?: number
          code?: string
          created_at?: string | null
        }
        Relationships: []
      }
      sabre_oauth_tokens: {
        Row: {
          id: number
          token: string
          expires_at: string
          created_at: string | null
        }
        Insert: {
          id?: number
          token: string
          expires_at: string
          created_at?: string | null
        }
        Update: {
          id?: number
          token?: string
          expires_at?: string
          created_at?: string | null
        }
        Relationships: []
      }
      sabre_tokens: {
        Row: {
          id: string
          json_token: string | null
          json_token_expires_at: string | null
          soap_session_token: string | null
          soap_session_token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          json_token?: string | null
          json_token_expires_at?: string | null
          soap_session_token?: string | null
          soap_session_token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          json_token?: string | null
          json_token_expires_at?: string | null
          soap_session_token?: string | null
          soap_session_token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type BrandRow = Database["pre_departure"]["Tables"]["brands"]["Row"]
export type BrandInsert = Database["pre_departure"]["Tables"]["brands"]["Insert"]
export type PnrNote = Database["pre_departure"]["Tables"]["PNR_Note"]["Row"]
export type PnrNoteInsert = Database["pre_departure"]["Tables"]["PNR_Note"]["Insert"]
export type ReportItRow = Database["pre_departure"]["Tables"]["PNR_Report_IT"]["Row"]
export type Profile = Database["pre_departure"]["Tables"]["profiles"]["Row"]
export type ProfileInsert = Database["pre_departure"]["Tables"]["profiles"]["Insert"]
export type ProfileUpdate = Database["pre_departure"]["Tables"]["profiles"]["Update"]
export type RolePermission =
  Database["pre_departure"]["Tables"]["role_permissions"]["Row"]
export type SabreOAuthToken = Database["pre_departure"]["Tables"]["sabre_oauth_tokens"]["Row"]
export type SabreOAuthTokenInsert =
  Database["pre_departure"]["Tables"]["sabre_oauth_tokens"]["Insert"]
export type SabreOAuthTokenUpdate =
  Database["pre_departure"]["Tables"]["sabre_oauth_tokens"]["Update"]
export type SabreToken = Database["pre_departure"]["Tables"]["sabre_tokens"]["Row"]
export type SabreTokenInsert = Database["pre_departure"]["Tables"]["sabre_tokens"]["Insert"]
export type SabreTokenUpdate = Database["pre_departure"]["Tables"]["sabre_tokens"]["Update"]
export type UserRole = Profile["role"]
