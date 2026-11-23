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
  public: {
    Tables: {
      activity_entries: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string
          event_id: string
          id: string
          kind: string
          title: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: string
          event_id: string
          id?: string
          kind: string
          title: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string
          event_id?: string
          id?: string
          kind?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_entries_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          created_by: string
          description: string
          event_id: string
          id: string
          name: string
          type: Database["public"]["Enums"]["category_kind"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          event_id: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["category_kind"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          event_id?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["category_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      category_fields: {
        Row: {
          category_id: string
          created_at: string
          display_order: number
          id: string
          label: string
          required: boolean
          type: Database["public"]["Enums"]["tracked_field_type"]
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          display_order?: number
          id?: string
          label: string
          required?: boolean
          type?: Database["public"]["Enums"]["tracked_field_type"]
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          display_order?: number
          id?: string
          label?: string
          required?: boolean
          type?: Database["public"]["Enums"]["tracked_field_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_fields_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      counted_items: {
        Row: {
          category_id: string
          created_at: string
          id: string
          image_path: string | null
          location: string
          minimum_quantity: number
          name: string
          quantity: number
          target_quantity: number
          updated_at: string
          version: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          image_path?: string | null
          location?: string
          minimum_quantity?: number
          name: string
          quantity?: number
          target_quantity?: number
          updated_at?: string
          version?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          image_path?: string | null
          location?: string
          minimum_quantity?: number
          name?: string
          quantity?: number
          target_quantity?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "counted_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      event_access_codes: {
        Row: {
          admin_code_hash: string
          admin_rotated_at: string
          event_id: string
          member_code_hash: string
          member_rotated_at: string
        }
        Insert: {
          admin_code_hash: string
          admin_rotated_at?: string
          event_id: string
          member_code_hash: string
          member_rotated_at?: string
        }
        Update: {
          admin_code_hash?: string
          admin_rotated_at?: string
          event_id?: string
          member_code_hash?: string
          member_rotated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_access_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_members: {
        Row: {
          created_at: string
          event_id: string
          role: Database["public"]["Enums"]["event_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          role?: Database["public"]["Enums"]["event_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          role?: Database["public"]["Enums"]["event_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          creator_id: string
          end_date: string | null
          id: string
          location: string
          name: string
          note: string
          short_name: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          end_date?: string | null
          id?: string
          location?: string
          name: string
          note?: string
          short_name?: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          end_date?: string | null
          id?: string
          location?: string
          name?: string
          note?: string
          short_name?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_read_state: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_read_state_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "activity_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_read_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tracked_record_values: {
        Row: {
          created_at: string
          field_id: string
          id: string
          tracked_record_id: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          tracked_record_id: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          tracked_record_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_record_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "category_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracked_record_values_tracked_record_id_fkey"
            columns: ["tracked_record_id"]
            isOneToOne: false
            referencedRelation: "tracked_records"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_records: {
        Row: {
          assignment_note: string
          category_id: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["tracked_status"]
          updated_at: string
          version: number
        }
        Insert: {
          assignment_note?: string
          category_id: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["tracked_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          assignment_note?: string
          category_id?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["tracked_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tracked_records_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_counted_quantity: {
        Args: { p_delta: number; p_expected_version: number; p_item_id: string }
        Returns: {
          category_id: string
          created_at: string
          id: string
          image_path: string | null
          location: string
          minimum_quantity: number
          name: string
          quantity: number
          target_quantity: number
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "counted_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_event: {
        Args: {
          p_end_date?: string
          p_location?: string
          p_name: string
          p_note?: string
          p_short_name?: string
          p_start_date?: string
        }
        Returns: Json
      }
      has_event_role: {
        Args: {
          p_event_id: string
          p_roles: Database["public"]["Enums"]["event_role"][]
        }
        Returns: boolean
      }
      is_event_member: { Args: { p_event_id: string }; Returns: boolean }
      join_event: {
        Args: { p_admin?: boolean; p_code: string }
        Returns: {
          created_at: string
          event_id: string
          role: Database["public"]["Enums"]["event_role"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rotate_event_code: {
        Args: { p_admin?: boolean; p_event_id: string }
        Returns: string
      }
    }
    Enums: {
      category_kind: "counted" | "tracked"
      event_role: "creator" | "admin" | "member"
      tracked_field_type: "text" | "number" | "date" | "boolean"
      tracked_status: "available" | "used"
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
  public: {
    Enums: {
      category_kind: ["counted", "tracked"],
      event_role: ["creator", "admin", "member"],
      tracked_field_type: ["text", "number", "date", "boolean"],
      tracked_status: ["available", "used"],
    },
  },
} as const

