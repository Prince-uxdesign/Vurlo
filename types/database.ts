/**
 * Supabase database types for Vurlo.
 *
 * Mirrors supabase/migrations. Once a Supabase project is linked, regenerate
 * with: supabase gen types typescript --project-id <id> > types/database.ts
 * (the generated output has the same shape as this file).
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      links: {
        Row: {
          id: string;
          user_id: string | null;
          destination_url: string;
          slug: string;
          is_custom_alias: boolean;
          status: string;
          expires_at: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          destination_url: string;
          slug: string;
          is_custom_alias?: boolean;
          status?: string;
          expires_at?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          destination_url?: string;
          slug?: string;
          is_custom_alias?: boolean;
          status?: string;
          expires_at?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; email: string | null; created_at: string };
        Insert: { id: string; email?: string | null; created_at?: string };
        Update: { id?: string; email?: string | null; created_at?: string };
        Relationships: [];
      };
      retired_slugs: {
        Row: { slug: string; link_id: string; retired_at: string };
        Insert: { slug: string; link_id: string; retired_at?: string };
        Update: { slug?: string; link_id?: string; retired_at?: string };
        Relationships: [];
      };
      rate_limits: {
        Row: { key: string; window_start: string; count: number };
        Insert: { key: string; window_start: string; count?: number };
        Update: { key?: string; window_start?: string; count?: number };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      active_link_limit: {
        Args: Record<string, never>;
        Returns: number;
      };
      max_slug_changes: {
        Args: Record<string, never>;
        Returns: number;
      };
      is_slug_taken: {
        Args: { p_slug: string };
        Returns: { taken: boolean }[];
      };
      list_my_links: {
        Args: {
          p_search?: string | null;
          p_filter?: string;
          p_sort?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          slug: string;
          destination_url: string;
          is_custom_alias: boolean;
          status: string;
          effective_status: string;
          expires_at: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          created_at: string;
          updated_at: string;
          total_count: number;
        }[];
      };
      my_link_stats: {
        Args: Record<string, never>;
        Returns: {
          total: number;
          listed: number;
          active: number;
          expiring: number;
          expired: number;
          disabled: number;
          archived: number;
        }[];
      };
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: {
          allowed: boolean;
          remaining: number;
          retry_after_seconds: number;
        }[];
      };
      effective_link_status: {
        Args: { p_status: string; p_expires_at: string | null };
        Returns: string;
      };
      is_reserved_slug: {
        Args: { p_slug: string };
        Returns: boolean;
      };
      resolve_link: {
        Args: { p_slug: string };
        Returns: {
          status: string;
          destination_url: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
