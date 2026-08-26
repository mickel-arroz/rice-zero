/**
 * Forma de la base de datos, espejo de `supabase/migrations/`.
 *
 * Escrito a mano con la forma que produce `supabase gen types typescript`,
 * para poder regenerarlo sobre este mismo archivo cuando el proyecto exista:
 *
 *     npx supabase gen types typescript --project-id <ref> --schema public \
 *       > lib/supabase/database.types.ts
 *
 * Si tocas una migración, actualiza esto en el mismo commit: es el único
 * punto donde el esquema y TypeScript se ponen de acuerdo.
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
      projects: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_versions: {
        Row: {
          id: string;
          project_id: string;
          version_number: number;
          label: string | null;
          source_version_id: string | null;
          created_at: string;
          updated_at: string;
        };
        // `version_number` lo pone un trigger: mandarlo desde el cliente no
        // es un error, pero se ignora. Por eso no aparece aquí.
        Insert: {
          id?: string;
          project_id: string;
          label?: string | null;
          source_version_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          label?: string | null;
          source_version_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      nodes: {
        Row: {
          id: string;
          version_id: string;
          parent_id: string | null;
          content: string;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          version_id: string;
          parent_id?: string | null;
          content?: string;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          version_id?: string;
          parent_id?: string | null;
          content?: string;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_analyses: {
        Row: {
          id: string;
          version_id: string;
          user_guidelines: string | null;
          provider: string;
          model: string;
          summary: string;
          questions: Json;
          features: Json;
          master_prompt: string;
          feature_prompts: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          version_id: string;
          user_guidelines?: string | null;
          provider: string;
          model: string;
          summary: string;
          questions?: Json;
          features?: Json;
          master_prompt: string;
          feature_prompts?: Json;
          created_at?: string;
        };
        // Un Análisis no se edita: la migración no le da política de update.
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      clone_project_version: {
        Args: { p_version_id: string; p_label?: string | null };
        Returns: Database["public"]["Tables"]["project_versions"]["Row"];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
