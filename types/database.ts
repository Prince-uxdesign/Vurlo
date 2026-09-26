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
        Row: { id: string; email: string | null; created_at: string; default_link_expiration: string };
        Insert: { id: string; email?: string | null; created_at?: string; default_link_expiration?: string };
        Update: { id?: string; email?: string | null; created_at?: string; default_link_expiration?: string };
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
      link_events: {
        Row: {
          id: string;
          link_id: string;
          occurred_at: string;
          visitor_hash: string | null;
          device_type: string;
          browser: string;
          operating_system: string;
          country_code: string;
          referrer_source: string;
          traffic_class: string;
          is_bot: boolean;
        };
        Insert: {
          id?: string;
          link_id: string;
          occurred_at?: string;
          visitor_hash?: string | null;
          device_type?: string;
          browser?: string;
          operating_system?: string;
          country_code?: string;
          referrer_source?: string;
          traffic_class?: string;
          is_bot?: boolean;
        };
        Update: {
          id?: string;
          link_id?: string;
          occurred_at?: string;
          visitor_hash?: string | null;
          device_type?: string;
          browser?: string;
          operating_system?: string;
          country_code?: string;
          referrer_source?: string;
          traffic_class?: string;
          is_bot?: boolean;
        };
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
      rate_limit_peek: {
        Args: { p_key: string; p_window_seconds: number };
        Returns: { count: number; retry_after_seconds: number }[];
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
      record_link_event: {
        Args: {
          p_slug: string;
          p_device_type?: string;
          p_browser?: string;
          p_operating_system?: string;
          p_country_code?: string;
          p_referrer_source?: string;
          p_traffic_class?: string;
          p_is_bot?: boolean;
          p_visitor_hash?: string | null;
        };
        Returns: string;
      };
      my_link_event_stats: {
        Args: { p_link_id: string };
        Returns: {
          total: number;
          human: number;
          bots: number;
          scanners: number;
          approx_uniques: number;
          last_clicked_at: string | null;
        }[];
      };
      owns_link: {
        Args: { p_link_id: string };
        Returns: boolean;
      };
      my_link_metrics: {
        Args: { p_link_id: string; p_start?: string | null; p_end?: string | null };
        Returns: {
          total_requests: number;
          human_clicks: number;
          bots: number;
          scanners: number;
          unknown_traffic: number;
          approx_uniques: number;
          approx_human_uniques: number;
          last_clicked_at: string | null;
        }[];
      };
      my_link_timeseries: {
        Args: { p_link_id: string; p_start: string; p_end: string; p_bucket?: string };
        Returns: { bucket_start: string; total: number; human: number }[];
      };
      my_link_breakdown: {
        Args: {
          p_link_id: string;
          p_dimension: string;
          p_start?: string | null;
          p_end?: string | null;
        };
        Returns: { key: string; total: number; human: number }[];
      };
      my_account_metrics: {
        Args: { p_start?: string | null; p_end?: string | null };
        Returns: {
          total_requests: number;
          human_clicks: number;
          bots: number;
          scanners: number;
          approx_uniques: number;
          links_clicked: number;
          total_links: number;
          last_clicked_at: string | null;
        }[];
      };
      my_links_clicks: {
        Args: { p_link_ids: string[] };
        Returns: { link_id: string; human_clicks: number; last_clicked_at: string | null }[];
      };
      my_account_timeseries: {
        Args: { p_start: string; p_end: string };
        Returns: { bucket_start: string; total: number; human: number }[];
      };
      my_top_links: {
        Args: { p_start?: string | null; p_end?: string | null; p_limit?: number };
        Returns: { link_id: string; slug: string; human_clicks: number }[];
      };
      my_recent_activity: {
        Args: { p_limit?: number };
        Returns: {
          kind: string;
          link_id: string;
          slug: string;
          occurred_at: string;
          clicks: number;
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
