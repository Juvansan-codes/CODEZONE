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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      challenges: {
        Row: {
          challenge_type: string
          created_at: string
          description: string
          difficulty: string
          end_date: string | null
          id: string
          is_active: boolean
          requirements: Json
          reward_coins: number
          reward_gems: number
          reward_xp: number
          start_date: string | null
          title: string
        }
        Insert: {
          challenge_type?: string
          created_at?: string
          description: string
          difficulty?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          requirements?: Json
          reward_coins?: number
          reward_gems?: number
          reward_xp?: number
          start_date?: string | null
          title: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          description?: string
          difficulty?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          requirements?: Json
          reward_coins?: number
          reward_gems?: number
          reward_xp?: number
          start_date?: string | null
          title?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      match_history: {
        Row: {
          coins_earned: number
          created_at: string
          duration_seconds: number
          id: string
          match_id: string
          opponent_ids: string[]
          problems_solved: number
          result: string
          score: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          coins_earned?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          match_id: string
          opponent_ids?: string[]
          problems_solved?: number
          result: string
          score?: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          coins_earned?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          match_id?: string
          opponent_ids?: string[]
          problems_solved?: number
          result?: string
          score?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_history_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_players: {
        Row: {
          created_at: string
          id: string
          is_winner: boolean | null
          match_id: string
          problems_solved: number
          score: number
          team: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_winner?: boolean | null
          match_id: string
          problems_solved?: number
          score?: number
          team: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_winner?: boolean | null
          match_id?: string
          problems_solved?: number
          score?: number
          team?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          ended_at: string | null
          game_mode: string
          id: string
          started_at: string | null
          status: string
          team_a: string[]
          team_b: string[]
          team_size: number
          winner_team: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          game_mode: string
          id?: string
          started_at?: string | null
          status?: string
          team_a?: string[]
          team_b?: string[]
          team_size: number
          winner_team?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          game_mode?: string
          id?: string
          started_at?: string | null
          status?: string
          team_a?: string[]
          team_b?: string[]
          team_size?: number
          winner_team?: string | null
        }
        Relationships: []
      }
      matchmaking_queue: {
        Row: {
          created_at: string
          game_mode: string
          id: string
          match_id: string | null
          rank_tier: string
          status: string
          team_size: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_mode: string
          id?: string
          match_id?: string | null
          rank_tier?: string
          status?: string
          team_size: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_mode?: string
          id?: string
          match_id?: string | null
          rank_tier?: string
          status?: string
          team_size?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      parties: {
        Row: {
          created_at: string
          game_mode: string
          id: string
          leader_id: string
          match_id: string | null
          status: string
          team_size: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_mode?: string
          id?: string
          leader_id: string
          match_id?: string | null
          status?: string
          team_size?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_mode?: string
          id?: string
          leader_id?: string
          match_id?: string | null
          status?: string
          team_size?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      party_members: {
        Row: {
          id: string
          is_ready: boolean
          joined_at: string
          party_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_ready?: boolean
          joined_at?: string
          party_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_ready?: boolean
          joined_at?: string
          party_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_members_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          best_rank: string
          coins: number
          created_at: string
          current_status: string | null
          display_name: string | null
          gems: number
          id: string
          is_admin: boolean | null
          is_online: boolean | null
          last_seen: string | null
          level: number
          rank: string
          total_matches: number
          total_wins: number
          unique_id: string | null
          updated_at: string
          user_id: string
          username: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          best_rank?: string
          coins?: number
          created_at?: string
          current_status?: string | null
          display_name?: string | null
          gems?: number
          id?: string
          is_admin?: boolean | null
          is_online?: boolean | null
          last_seen?: string | null
          level?: number
          rank?: string
          total_matches?: number
          total_wins?: number
          unique_id?: string | null
          updated_at?: string
          user_id: string
          username: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          best_rank?: string
          coins?: number
          created_at?: string
          current_status?: string | null
          display_name?: string | null
          gems?: number
          id?: string
          is_admin?: boolean | null
          is_online?: boolean | null
          last_seen?: string | null
          level?: number
          rank?: string
          total_matches?: number
          total_wins?: number
          unique_id?: string | null
          updated_at?: string
          user_id?: string
          username?: string
          xp?: number
        }
        Relationships: []
      }
      user_analytics: {
        Row: {
          coins_earned: number
          created_at: string
          date: string
          id: string
          matches_played: number
          matches_won: number
          problems_solved: number
          sabotages_used: number
          time_played_seconds: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          coins_earned?: number
          created_at?: string
          date?: string
          id?: string
          matches_played?: number
          matches_won?: number
          problems_solved?: number
          sabotages_used?: number
          time_played_seconds?: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          coins_earned?: number
          created_at?: string
          date?: string
          id?: string
          matches_played?: number
          matches_won?: number
          problems_solved?: number
          sabotages_used?: number
          time_played_seconds?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: []
      }
      questions: {
        Row: {
          created_at: string
          description: string
          difficulty: "Easy" | "Medium" | "Hard" | "Expert" | null
          game_mode: string | null
          id: string
          template_code: string | null
          test_cases: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          difficulty?: "Easy" | "Medium" | "Hard" | "Expert" | null
          game_mode?: string | null
          id?: string
          template_code?: string | null
          test_cases?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          difficulty?: "Easy" | "Medium" | "Hard" | "Expert" | null
          game_mode?: string | null
          id?: string
          template_code?: string | null
          test_cases?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_challenges: {
        Row: {
          challenge_id: string
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          progress: number
          target: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          progress?: number
          target?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          progress?: number
          target?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string | null
          level: number | null
          rank: string | null
          total_matches: number | null
          total_wins: number | null
          username: string | null
          win_rate: number | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
          level?: number | null
          rank?: string | null
          total_matches?: number | null
          total_wins?: number | null
          username?: string | null
          win_rate?: never
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
          level?: number | null
          rank?: string | null
          total_matches?: number | null
          total_wins?: number | null
          username?: string | null
          win_rate?: never
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
