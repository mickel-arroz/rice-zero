/**
 * Forma de la base de datos, espejo de `db/migrations/` con el preludio de
 * Neon.
 *
 * Vive DENTRO del adaptador y nunca aparece en la firma del puerto: eso es lo
 * que permite que el otro adaptador tenga su propio archivo generado sin que la
 * app se entere. Ver `docs/adr/0001-proveedor-de-backend-intercambiable.md`.
 *
 * Escrito a mano con la forma que produce el generador de Neon, para poder
 * regenerarlo sobre este mismo archivo:
 *
 *     npx @neondatabase/neon-js gen-types --db-url "$DATABASE_URL"  *       > lib/backend/adapters/neon/database.types.ts
 *
 * Es un archivo aparte del de Supabase aunque hoy describa el mismo esquema:
 * los genera cada proveedor con su propio CLI y no tienen por qué coincidir
 * (empezando por el tipo del id de usuario). Lo que atrapa una divergencia real
 * es `schema-check.ts`, que compara estos tipos con `rows.ts`.
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
          icon: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          description?: string | null;
          icon?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          description?: string | null;
          icon?: string;
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
          // El Análisis entero, como objeto. Ver la migración `0003`.
          analysis: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          version_id: string;
          user_guidelines?: string | null;
          provider: string;
          model: string;
          analysis: Json;
          created_at?: string;
        };
        // Un Análisis no se edita: la migración no le da política de update.
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      // Los contadores llegan como `int` porque la vista los castea: PostgREST
      // serializa un `bigint` como cadena, y `count(*)` es `bigint`.
      project_overviews: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          icon: string;
          created_at: string;
          updated_at: string;
          version_count: number;
          node_count: number;
          analysis_count: number;
          last_activity_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_project_with_version: {
        Args: { p_title: string; p_description?: string | null; p_icon?: string | null };
        Returns: Database["public"]["Tables"]["projects"]["Row"];
      };
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

export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
