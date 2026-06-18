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
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: 'org_members_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'competitors_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'tracked_pages_competitor_id_fkey'
            columns: ['competitor_id']
            isOneToOne: false
            referencedRelation: 'competitors'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'page_snapshots_tracked_page_id_fkey'
            columns: ['tracked_page_id']
            isOneToOne: false
            referencedRelation: 'tracked_pages'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'changes_tracked_page_id_fkey'
            columns: ['tracked_page_id']
            isOneToOne: false
            referencedRelation: 'tracked_pages'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'watchlists_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'watchlist_competitors_watchlist_id_fkey'
            columns: ['watchlist_id']
            isOneToOne: false
            referencedRelation: 'watchlists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'watchlist_competitors_competitor_id_fkey'
            columns: ['competitor_id']
            isOneToOne: false
            referencedRelation: 'competitors'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'digests_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      competitor_snapshots: {
        Row: {
          id: string
          competitor_id: string
          tracked_page_id: string
          snapshot_date: string
          page_type: string
          raw_text: string | null
          parsed_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          competitor_id: string
          tracked_page_id: string
          snapshot_date?: string
          page_type?: string
          raw_text?: string | null
          parsed_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          competitor_id?: string
          tracked_page_id?: string
          snapshot_date?: string
          page_type?: string
          raw_text?: string | null
          parsed_data?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      competitor_diffs: {
        Row: {
          id: string
          competitor_id: string
          tracked_page_id: string
          change_type: string
          detected_at: string
          summary: string | null
          old_value: Json | null
          new_value: Json | null
        }
        Insert: {
          id?: string
          competitor_id: string
          tracked_page_id: string
          change_type?: string
          detected_at?: string
          summary?: string | null
          old_value?: Json | null
          new_value?: Json | null
        }
        Update: {
          id?: string
          competitor_id?: string
          tracked_page_id?: string
          change_type?: string
          detected_at?: string
          summary?: string | null
          old_value?: Json | null
          new_value?: Json | null
        }
        Relationships: []
      }
      risk_score_history: {
        Row: {
          id: string
          competitor_id: string
          scored_at: string
          product_velocity: number
          messaging_overlap: number
          market_reach: number
          total: number
        }
        Insert: {
          id?: string
          competitor_id: string
          scored_at?: string
          product_velocity?: number
          messaging_overlap?: number
          market_reach?: number
          total?: number
        }
        Update: {
          id?: string
          competitor_id?: string
          scored_at?: string
          product_velocity?: number
          messaging_overlap?: number
          market_reach?: number
          total?: number
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_user_org: {
        Args: { p_user_id: string; p_name: string; p_slug: string }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
