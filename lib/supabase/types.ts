export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
        }
      }
      org_members: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          role?: string
          created_at?: string
        }
      }
      competitors: {
        Row: {
          id: string
          org_id: string
          name: string
          website: string
          logo_url: string | null
          risk_score: number
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          website: string
          logo_url?: string | null
          risk_score?: number
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          website?: string
          logo_url?: string | null
          risk_score?: number
          created_at?: string
        }
      }
      tracked_pages: {
        Row: {
          id: string
          competitor_id: string
          url: string
          label: string | null
          last_crawled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          competitor_id: string
          url: string
          label?: string | null
          last_crawled_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          competitor_id?: string
          url?: string
          label?: string | null
          last_crawled_at?: string | null
          created_at?: string
        }
      }
      page_snapshots: {
        Row: {
          id: string
          tracked_page_id: string
          html_content: string | null
          text_content: string | null
          storage_path: string | null
          crawled_at: string
        }
        Insert: {
          id?: string
          tracked_page_id: string
          html_content?: string | null
          text_content?: string | null
          storage_path?: string | null
          crawled_at?: string
        }
        Update: {
          id?: string
          tracked_page_id?: string
          html_content?: string | null
          text_content?: string | null
          storage_path?: string | null
          crawled_at?: string
        }
      }
      changes: {
        Row: {
          id: string
          tracked_page_id: string
          before_snapshot_id: string | null
          after_snapshot_id: string | null
          diff_html: string | null
          ai_summary: string | null
          ai_signal: string | null
          confidence: number | null
          risk_score: number | null
          theme: string | null
          impact_bullets: Json | null
          suggested_actions: Json | null
          detected_at: string
        }
        Insert: {
          id?: string
          tracked_page_id: string
          before_snapshot_id?: string | null
          after_snapshot_id?: string | null
          diff_html?: string | null
          ai_summary?: string | null
          ai_signal?: string | null
          confidence?: number | null
          risk_score?: number | null
          theme?: string | null
          impact_bullets?: Json | null
          suggested_actions?: Json | null
          detected_at?: string
        }
        Update: {
          id?: string
          tracked_page_id?: string
          before_snapshot_id?: string | null
          after_snapshot_id?: string | null
          diff_html?: string | null
          ai_summary?: string | null
          ai_signal?: string | null
          confidence?: number | null
          risk_score?: number | null
          theme?: string | null
          impact_bullets?: Json | null
          suggested_actions?: Json | null
          detected_at?: string
        }
      }
      watchlists: {
        Row: {
          id: string
          org_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          created_at?: string
        }
      }
      watchlist_competitors: {
        Row: {
          watchlist_id: string
          competitor_id: string
        }
        Insert: {
          watchlist_id: string
          competitor_id: string
        }
        Update: {
          watchlist_id?: string
          competitor_id?: string
        }
      }
      digests: {
        Row: {
          id: string
          org_id: string
          week_start: string
          content: Json | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          week_start: string
          content?: Json | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          week_start?: string
          content?: Json | null
          sent_at?: string | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
