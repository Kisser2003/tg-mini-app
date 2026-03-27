export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      error_logs: {
        Row: {
          created_at: string
          error_message: string
          id: string
          screen_name: string | null
          stack_trace: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message: string
          id?: string
          screen_name?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string
          id?: string
          screen_name?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_moderation_logs: {
        Row: {
          id: string
          release_id: string
          user_id: number | null
          status: string
          flagged_reasons: Json
          confidence_score: number | null
          model: string | null
          created_at: string
        }
        Insert: {
          id?: string
          release_id: string
          user_id?: number | null
          status: string
          flagged_reasons?: Json
          confidence_score?: number | null
          model?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          release_id?: string
          user_id?: number | null
          status?: string
          flagged_reasons?: Json
          confidence_score?: number | null
          model?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_moderation_logs_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      release_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          release_id: string | null
          stage: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          release_id?: string | null
          stage?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          release_id?: string | null
          stage?: string | null
          status?: string | null
        }
        Relationships: []
      }
      release_tracks: {
        Row: {
          audio_url: string
          created_at: string | null
          explicit: boolean | null
          file_path: string | null
          id: string
          index: number
          release_id: string
          title: string
        }
        Insert: {
          audio_url: string
          created_at?: string | null
          explicit?: boolean | null
          file_path?: string | null
          id?: string
          index: number
          release_id: string
          title: string
        }
        Update: {
          audio_url?: string
          created_at?: string | null
          explicit?: boolean | null
          file_path?: string | null
          id?: string
          index?: number
          release_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_tracks_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      release_views: {
        Row: {
          id: string
          release_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          release_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          release_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_views_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      releases: {
        Row: {
          admin_notes: string | null
          artist_links: Json | null
          artist_name: string | null
          artwork_url: string | null
          audio_url: string | null
          author_full_name: string | null
          c_line: string | null
          client_request_id: string | null
          collaborators: Json | null
          created_at: string
          draft_upload_started: boolean | null
          error_message: string | null
          explicit: boolean | null
          genre: string | null
          id: string
          is_explicit: boolean | null
          isrc: string | null
          language: string | null
          license_type: string | null
          lyrics: string | null
          moderator_notes: string | null
          mood: string | null
          music_author: string | null
          p_line: string | null
          performance_language: string | null
          planned_release_date: string | null
          release_date: string | null
          release_type: string | null
          status: Database["public"]["Enums"]["release_status"] | null
          sub_genre: string | null
          telegram_id: string | null
          telegram_pending_ack_sent_at: string | null
          telegram_username: string | null
          title: string | null
          track_name: string | null
          upc: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          artist_links?: Json | null
          artist_name?: string | null
          artwork_url?: string | null
          audio_url?: string | null
          author_full_name?: string | null
          c_line?: string | null
          client_request_id?: string | null
          collaborators?: Json | null
          created_at?: string
          draft_upload_started?: boolean | null
          error_message?: string | null
          explicit?: boolean | null
          genre?: string | null
          id?: string
          is_explicit?: boolean | null
          isrc?: string | null
          language?: string | null
          license_type?: string | null
          lyrics?: string | null
          moderator_notes?: string | null
          mood?: string | null
          music_author?: string | null
          p_line?: string | null
          performance_language?: string | null
          planned_release_date?: string | null
          release_date?: string | null
          release_type?: string | null
          status?: Database["public"]["Enums"]["release_status"] | null
          sub_genre?: string | null
          telegram_id?: string | null
          telegram_pending_ack_sent_at?: string | null
          telegram_username?: string | null
          title?: string | null
          track_name?: string | null
          upc?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          artist_links?: Json | null
          artist_name?: string | null
          artwork_url?: string | null
          audio_url?: string | null
          author_full_name?: string | null
          c_line?: string | null
          client_request_id?: string | null
          collaborators?: Json | null
          created_at?: string
          draft_upload_started?: boolean | null
          error_message?: string | null
          explicit?: boolean | null
          genre?: string | null
          id?: string
          is_explicit?: boolean | null
          isrc?: string | null
          language?: string | null
          license_type?: string | null
          lyrics?: string | null
          moderator_notes?: string | null
          mood?: string | null
          music_author?: string | null
          p_line?: string | null
          performance_language?: string | null
          planned_release_date?: string | null
          release_date?: string | null
          release_type?: string | null
          status?: Database["public"]["Enums"]["release_status"] | null
          sub_genre?: string | null
          telegram_id?: string | null
          telegram_pending_ack_sent_at?: string | null
          telegram_username?: string | null
          title?: string | null
          track_name?: string | null
          upc?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tracks: {
        Row: {
          created_at: string | null
          duration: number | null
          explicit: boolean | null
          file_path: string | null
          id: string
          index: number | null
          position: number | null
          release_id: string | null
          telegram_id: string | null
          title: string | null
          user_id: number | null
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          explicit?: boolean | null
          file_path?: string | null
          id?: string
          index?: number | null
          position?: number | null
          release_id?: string | null
          telegram_id?: string | null
          title?: string | null
          user_id?: number | null
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          explicit?: boolean | null
          file_path?: string | null
          id?: string
          index?: number | null
          position?: number | null
          release_id?: string | null
          telegram_id?: string | null
          title?: string | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tracks_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          available_at: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          metadata: Json | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          available_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          available_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          payout_details: Json | null
          payout_method: string | null
          push_notifications: boolean | null
          updated_at: string | null
          user_id: number
        }
        Insert: {
          created_at?: string | null
          payout_details?: Json | null
          payout_method?: string | null
          push_notifications?: boolean | null
          updated_at?: string | null
          user_id: number
        }
        Update: {
          created_at?: string | null
          payout_details?: Json | null
          payout_method?: string | null
          push_notifications?: boolean | null
          updated_at?: string | null
          user_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_release_safe: {
        Args: {
          p_client_request_id: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      finalize_release: {
        Args: { p_client_request_id: string; p_release_id: string }
        Returns: Json
      }
      log_release_event: {
        Args: {
          p_error?: string
          p_release_id: string
          p_stage: string
          p_status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      release_status:
        | "draft"
        | "processing"
        | "ready"
        | "failed"
        | "review"
        | "pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      release_status: [
        "draft",
        "processing",
        "ready",
        "failed",
        "review",
        "pending",
      ],
    },
  },
} as const
