export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export type Database = {
  public: {
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

export type BrandRow = Database["public"]["Tables"]["brands"]["Row"]
export type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"]
export type PnrNote = Database["public"]["Tables"]["PNR_Note"]["Row"]
export type PnrNoteInsert = Database["public"]["Tables"]["PNR_Note"]["Insert"]
export type ReportItRow = Database["public"]["Tables"]["PNR_Report_IT"]["Row"]
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"]
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]
export type RolePermission =
  Database["public"]["Tables"]["role_permissions"]["Row"]
export type SabreOAuthToken = Database["public"]["Tables"]["sabre_oauth_tokens"]["Row"]
export type SabreOAuthTokenInsert =
  Database["public"]["Tables"]["sabre_oauth_tokens"]["Insert"]
export type SabreOAuthTokenUpdate =
  Database["public"]["Tables"]["sabre_oauth_tokens"]["Update"]
export type SabreToken = Database["public"]["Tables"]["sabre_tokens"]["Row"]
export type SabreTokenInsert = Database["public"]["Tables"]["sabre_tokens"]["Insert"]
export type SabreTokenUpdate = Database["public"]["Tables"]["sabre_tokens"]["Update"]
export type UserRole = Profile["role"]
