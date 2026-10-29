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
    PostgrestVersion: "14.18"
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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string
          created_at: string
          deleted_at: string | null
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          summary: string
          updated_at: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label: string
          created_at?: string
          deleted_at?: string | null
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          summary: string
          updated_at?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          deleted_at?: string | null
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          deleted_at: string | null
          forgotten_reply_hours: number
          id: boolean
          updated_at: string
          working_hours_end: string
          working_hours_start: string
          working_hours_timezone: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          forgotten_reply_hours?: number
          id?: boolean
          updated_at?: string
          working_hours_end?: string
          working_hours_start?: string
          working_hours_timezone?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          forgotten_reply_hours?: number
          id?: boolean
          updated_at?: string
          working_hours_end?: string
          working_hours_start?: string
          working_hours_timezone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          slack_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          slack_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          slack_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          actor_label: string
          api_key_id: string | null
          created_at: string
          created_count: number
          deleted_at: string | null
          errors: Json
          failed_count: number
          finished_at: string | null
          id: string
          source: string
          started_at: string
          status: Database["public"]["Enums"]["sync_status"]
          unchanged_count: number
          updated_at: string
          updated_count: number
        }
        Insert: {
          actor_label: string
          api_key_id?: string | null
          created_at?: string
          created_count?: number
          deleted_at?: string | null
          errors?: Json
          failed_count?: number
          finished_at?: string | null
          id?: string
          source?: string
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
          unchanged_count?: number
          updated_at?: string
          updated_count?: number
        }
        Update: {
          actor_label?: string
          api_key_id?: string | null
          created_at?: string
          created_count?: number
          deleted_at?: string | null
          errors?: Json
          failed_count?: number
          finished_at?: string | null
          id?: string
          source?: string
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
          unchanged_count?: number
          updated_at?: string
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          created_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          changes_in: Database["public"]["Enums"]["task_change_area"][]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          environments: Database["public"]["Enums"]["task_env"][]
          human_edited_fields: string[]
          id: string
          jira_key: string | null
          jira_status: string | null
          jira_url: string | null
          last_client_message_at: string | null
          last_team_reply_at: string | null
          module: string | null
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          raw_slack: Json | null
          reply_dismissed_at: string | null
          slack_channel_id: string | null
          slack_thread_ts: string | null
          slack_url: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[]
          task_date: string
          task_number: number
          title: string
          updated_at: string
        }
        Insert: {
          changes_in?: Database["public"]["Enums"]["task_change_area"][]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          environments?: Database["public"]["Enums"]["task_env"][]
          human_edited_fields?: string[]
          id?: string
          jira_key?: string | null
          jira_status?: string | null
          jira_url?: string | null
          last_client_message_at?: string | null
          last_team_reply_at?: string | null
          module?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          raw_slack?: Json | null
          reply_dismissed_at?: string | null
          slack_channel_id?: string | null
          slack_thread_ts?: string | null
          slack_url?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          task_date?: string
          task_number?: never
          title: string
          updated_at?: string
        }
        Update: {
          changes_in?: Database["public"]["Enums"]["task_change_area"][]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          environments?: Database["public"]["Enums"]["task_env"][]
          human_edited_fields?: string[]
          id?: string
          jira_key?: string | null
          jira_status?: string | null
          jira_url?: string | null
          last_client_message_at?: string | null
          last_team_reply_at?: string | null
          module?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          raw_slack?: Json | null
          reply_dismissed_at?: string | null
          slack_channel_id?: string | null
          slack_thread_ts?: string | null
          slack_url?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          task_date?: string
          task_number?: never
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      delete_comment: { Args: { p_comment_id: string }; Returns: undefined }
      delete_task: { Args: { p_task_id: string }; Returns: undefined }
      dismiss_reply: {
        Args: { p_dismissed: boolean; p_task_id: string }
        Returns: undefined
      }
      is_admin_or_pm: { Args: never; Returns: boolean }
      is_assigned: { Args: { p_task_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_id: string
          p_entity_type: string
          p_summary: string
        }
        Returns: undefined
      }
      sync_threads: {
        Args: { p_actor: string; p_api_key_id: string; p_items: Json }
        Returns: Json
      }
    }
    Enums: {
      sync_status: "running" | "success" | "partial" | "failed"
      task_change_area: "fe" | "be" | "db" | "devops" | "design" | "other"
      task_env: "local" | "development" | "staging" | "production"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "backlog"
        | "to_do"
        | "in_progress"
        | "in_review"
        | "blocked"
        | "done"
      user_role: "super_admin" | "project_manager" | "developer" | "tester"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      sync_status: ["running", "success", "partial", "failed"],
      task_change_area: ["fe", "be", "db", "devops", "design", "other"],
      task_env: ["local", "development", "staging", "production"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "backlog",
        "to_do",
        "in_progress",
        "in_review",
        "blocked",
        "done",
      ],
      user_role: ["super_admin", "project_manager", "developer", "tester"],
    },
  },
} as const
