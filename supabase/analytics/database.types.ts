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
      actual_loading_records: {
        Row: {
          actual_load_id: string
          actual_weight: number | null
          booking_id: string | null
          created_at: string
          daily_load_number: number
          delivery_confirmed_at: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          driver_id: string | null
          factory_id: string | null
          load_date: string
          loading_sequence_date: string
          quarry_id: string | null
          scale_image_path: string | null
          source_record_id: string | null
          ticket_number: string | null
          trip_code: string
          vehicle_id: string | null
        }
        Insert: {
          actual_load_id?: string
          actual_weight?: number | null
          booking_id?: string | null
          created_at?: string
          daily_load_number: number
          delivery_confirmed_at?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          driver_id?: string | null
          factory_id?: string | null
          load_date: string
          loading_sequence_date: string
          quarry_id?: string | null
          scale_image_path?: string | null
          source_record_id?: string | null
          ticket_number?: string | null
          trip_code: string
          vehicle_id?: string | null
        }
        Update: {
          actual_load_id?: string
          actual_weight?: number | null
          booking_id?: string | null
          created_at?: string
          daily_load_number?: number
          delivery_confirmed_at?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          driver_id?: string | null
          factory_id?: string | null
          load_date?: string
          loading_sequence_date?: string
          quarry_id?: string | null
          scale_image_path?: string | null
          source_record_id?: string | null
          ticket_number?: string | null
          trip_code?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actual_loading_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "actual_loading_records_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "actual_loading_records_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["factory_id"]
          },
          {
            foreignKeyName: "actual_loading_records_quarry_id_fkey"
            columns: ["quarry_id"]
            isOneToOne: false
            referencedRelation: "quarries"
            referencedColumns: ["quarry_id"]
          },
          {
            foreignKeyName: "actual_loading_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      app_users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          display_name: string
          is_active: boolean
          office_id: string | null
          phone: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          display_name: string
          is_active?: boolean
          office_id?: string | null
          phone?: string | null
          user_id?: string
          username?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string
          is_active?: boolean
          office_id?: string | null
          phone?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_users_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["office_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          audit_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          audit_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          audit_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          assignment_daily_number: number
          assignment_sequence_date: string
          booked_at: string
          booking_id: string
          driver_id: string
          load_order_id: string | null
          status: Database["public"]["Enums"]["load_status"]
          trip_code: string
          vehicle_id: string
        }
        Insert: {
          assignment_daily_number: number
          assignment_sequence_date: string
          booked_at?: string
          booking_id?: string
          driver_id: string
          load_order_id?: string | null
          status?: Database["public"]["Enums"]["load_status"]
          trip_code: string
          vehicle_id: string
        }
        Update: {
          assignment_daily_number?: number
          assignment_sequence_date?: string
          booked_at?: string
          booking_id?: string
          driver_id?: string
          load_order_id?: string | null
          status?: Database["public"]["Enums"]["load_status"]
          trip_code?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "bookings_load_order_id_fkey"
            columns: ["load_order_id"]
            isOneToOne: false
            referencedRelation: "load_orders"
            referencedColumns: ["load_order_id"]
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      daily_loading_counters: {
        Row: {
          last_number: number
          loading_date: string
          updated_at: string
        }
        Insert: {
          last_number: number
          loading_date: string
          updated_at?: string
        }
        Update: {
          last_number?: number
          loading_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_trip_counters: {
        Row: {
          assignment_date: string
          last_number: number
          updated_at: string
        }
        Insert: {
          assignment_date: string
          last_number: number
          updated_at?: string
        }
        Update: {
          assignment_date?: string
          last_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      delivery_confirmations: {
        Row: {
          booking_id: string
          confirmed_at: string
          confirmed_by: string
          delivery_id: string
          latitude: number | null
          longitude: number | null
        }
        Insert: {
          booking_id: string
          confirmed_at?: string
          confirmed_by: string
          delivery_id?: string
          latitude?: number | null
          longitude?: number | null
        }
        Update: {
          booking_id?: string
          confirmed_at?: string
          confirmed_by?: string
          delivery_id?: string
          latitude?: number | null
          longitude?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_confirmations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "delivery_confirmations_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
        ]
      }
      dispatch_test_drivers: {
        Row: {
          arrived_at: string
          created_at: string
          driver_name: string
          test_driver_id: string
          vehicle_number: string
        }
        Insert: {
          arrived_at: string
          created_at?: string
          driver_name: string
          test_driver_id?: string
          vehicle_number: string
        }
        Update: {
          arrived_at?: string
          created_at?: string
          driver_name?: string
          test_driver_id?: string
          vehicle_number?: string
        }
        Relationships: []
      }
      driver_invitations: {
        Row: {
          created_at: string
          driver_id: string
          expires_at: string
          invitation_id: string
          invitation_token: string
          phone: string | null
          status: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          expires_at: string
          invitation_id?: string
          invitation_token: string
          phone?: string | null
          status?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          expires_at?: string
          invitation_id?: string
          invitation_token?: string
          phone?: string | null
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_invitations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
        ]
      }
      driver_live_locations: {
        Row: {
          accuracy_m: number | null
          captured_at: string
          driver_id: string
          heading: number | null
          latitude: number
          longitude: number
          speed_kmh: number | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          accuracy_m?: number | null
          captured_at: string
          driver_id: string
          heading?: number | null
          latitude: number
          longitude: number
          speed_kmh?: number | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          accuracy_m?: number | null
          captured_at?: string
          driver_id?: string
          heading?: number | null
          latitude?: number
          longitude?: number
          speed_kmh?: number | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_live_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "driver_live_locations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      driver_office_assignments: {
        Row: {
          assigned_from: string
          assigned_to: string | null
          assignment_id: string
          created_at: string
          driver_id: string
          office_id: string
        }
        Insert: {
          assigned_from?: string
          assigned_to?: string | null
          assignment_id?: string
          created_at?: string
          driver_id: string
          office_id: string
        }
        Update: {
          assigned_from?: string
          assigned_to?: string | null
          assignment_id?: string
          created_at?: string
          driver_id?: string
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_office_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "driver_office_assignments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["office_id"]
          },
        ]
      }
      drivers: {
        Row: {
          auth_user_id: string | null
          driver_code: string | null
          driver_id: string
          is_active: boolean
          name: string
          phone: string | null
        }
        Insert: {
          auth_user_id?: string | null
          driver_code?: string | null
          driver_id?: string
          is_active?: boolean
          name: string
          phone?: string | null
        }
        Update: {
          auth_user_id?: string | null
          driver_code?: string | null
          driver_id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      factories: {
        Row: {
          code: string | null
          factory_id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
        }
        Insert: {
          code?: string | null
          factory_id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
        }
        Update: {
          code?: string | null
          factory_id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
        }
        Relationships: []
      }
      historical_loading_staging: {
        Row: {
          driver_name: string | null
          factory_name: string | null
          load_date: string | null
          quality_note: string | null
          quarry_name: string | null
          source_row_number: number
          staging_id: number
          ticket_number: string | null
          vehicle_number_source: string | null
        }
        Insert: {
          driver_name?: string | null
          factory_name?: string | null
          load_date?: string | null
          quality_note?: string | null
          quarry_name?: string | null
          source_row_number: number
          staging_id?: never
          ticket_number?: string | null
          vehicle_number_source?: string | null
        }
        Update: {
          driver_name?: string | null
          factory_name?: string | null
          load_date?: string | null
          quality_note?: string | null
          quarry_name?: string | null
          source_row_number?: number
          staging_id?: never
          ticket_number?: string | null
          vehicle_number_source?: string | null
        }
        Relationships: []
      }
      load_orders: {
        Row: {
          check_in_office_id: string
          created_at: string
          factory_id: string
          load_order_id: string
          office_id: string
          priority: number
          published_at: string | null
          quarry_id: string
          requested_quantity: number
          status: Database["public"]["Enums"]["load_status"]
        }
        Insert: {
          check_in_office_id: string
          created_at?: string
          factory_id: string
          load_order_id?: string
          office_id: string
          priority?: number
          published_at?: string | null
          quarry_id: string
          requested_quantity: number
          status?: Database["public"]["Enums"]["load_status"]
        }
        Update: {
          check_in_office_id?: string
          created_at?: string
          factory_id?: string
          load_order_id?: string
          office_id?: string
          priority?: number
          published_at?: string | null
          quarry_id?: string
          requested_quantity?: number
          status?: Database["public"]["Enums"]["load_status"]
        }
        Relationships: [
          {
            foreignKeyName: "load_orders_check_in_office_id_fkey"
            columns: ["check_in_office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "load_orders_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["factory_id"]
          },
          {
            foreignKeyName: "load_orders_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "load_orders_quarry_id_fkey"
            columns: ["quarry_id"]
            isOneToOne: false
            referencedRelation: "quarries"
            referencedColumns: ["quarry_id"]
          },
        ]
      }
      loading_statements: {
        Row: {
          booking_id: string
          created_at: string
          statement_id: string
          statement_number: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          statement_id?: string
          statement_number?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          statement_id?: string
          statement_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loading_statements_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      location_events: {
        Row: {
          driver_id: string
          event_id: string
          event_type: Database["public"]["Enums"]["location_event_type"]
          latitude: number
          longitude: number
          office_id: string | null
          recorded_at: string
          vehicle_id: string | null
        }
        Insert: {
          driver_id: string
          event_id?: string
          event_type: Database["public"]["Enums"]["location_event_type"]
          latitude: number
          longitude: number
          office_id?: string | null
          recorded_at?: string
          vehicle_id?: string | null
        }
        Update: {
          driver_id?: string
          event_id?: string
          event_type?: Database["public"]["Enums"]["location_event_type"]
          latitude?: number
          longitude?: number
          office_id?: string | null
          recorded_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "location_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "location_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          driver_id: string | null
          notification_id: string
          read_at: string | null
          sent_at: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          driver_id?: string | null
          notification_id?: string
          read_at?: string | null
          sent_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          driver_id?: string | null
          notification_id?: string
          read_at?: string | null
          sent_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
        ]
      }
      offices: {
        Row: {
          created_at: string
          geofence_radius_m: number
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          office_id: string
          office_type: Database["public"]["Enums"]["office_type"]
        }
        Insert: {
          created_at?: string
          geofence_radius_m?: number
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          office_id?: string
          office_type: Database["public"]["Enums"]["office_type"]
        }
        Update: {
          created_at?: string
          geofence_radius_m?: number
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          office_id?: string
          office_type?: Database["public"]["Enums"]["office_type"]
        }
        Relationships: []
      }
      quarries: {
        Row: {
          code: string | null
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          quarry_id: string
        }
        Insert: {
          code?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          quarry_id?: string
        }
        Update: {
          code?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          quarry_id?: string
        }
        Relationships: []
      }
      quarry_factory_relations: {
        Row: {
          factory_id: string
          is_allowed: boolean
          quarry_id: string
          relation_id: string
        }
        Insert: {
          factory_id: string
          is_allowed?: boolean
          quarry_id: string
          relation_id?: string
        }
        Update: {
          factory_id?: string
          is_allowed?: boolean
          quarry_id?: string
          relation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quarry_factory_relations_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["factory_id"]
          },
          {
            foreignKeyName: "quarry_factory_relations_quarry_id_fkey"
            columns: ["quarry_id"]
            isOneToOne: false
            referencedRelation: "quarries"
            referencedColumns: ["quarry_id"]
          },
        ]
      }
      Reversed: {
        Row: {
          owner_name: string | null
          vehicle_number: string | null
        }
        Insert: {
          owner_name?: string | null
          vehicle_number?: string | null
        }
        Update: {
          owner_name?: string | null
          vehicle_number?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          description: string | null
          name: string
          role_id: string
        }
        Insert: {
          description?: string | null
          name: string
          role_id?: string
        }
        Update: {
          description?: string | null
          name?: string
          role_id?: string
        }
        Relationships: []
      }
      standalone_direct_load_audit: {
        Row: {
          accepted_at: string | null
          assigned_at: string
          assigned_by_auth_user_id: string
          audit_id: string
          booking_id: string
          driver_id: string
          factory_id: string
          office_id: string
          quarry_id: string
          vehicle_id: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string
          assigned_by_auth_user_id: string
          audit_id?: string
          booking_id: string
          driver_id: string
          factory_id: string
          office_id: string
          quarry_id: string
          vehicle_id: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string
          assigned_by_auth_user_id?: string
          audit_id?: string
          booking_id?: string
          driver_id?: string
          factory_id?: string
          office_id?: string
          quarry_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standalone_direct_load_audit_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "standalone_direct_load_audit_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "standalone_direct_load_audit_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["factory_id"]
          },
          {
            foreignKeyName: "standalone_direct_load_audit_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "standalone_direct_load_audit_quarry_id_fkey"
            columns: ["quarry_id"]
            isOneToOne: false
            referencedRelation: "quarries"
            referencedColumns: ["quarry_id"]
          },
          {
            foreignKeyName: "standalone_direct_load_audit_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role_id: string
          user_id: string
        }
        Insert: {
          role_id: string
          user_id: string
        }
        Update: {
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["role_id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vehicle_driver_assignments: {
        Row: {
          assigned_from: string
          assigned_to: string | null
          assignment_id: string
          driver_id: string
          vehicle_id: string
        }
        Insert: {
          assigned_from?: string
          assigned_to?: string | null
          assignment_id?: string
          driver_id: string
          vehicle_id: string
        }
        Update: {
          assigned_from?: string
          assigned_to?: string | null
          assignment_id?: string
          driver_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_driver_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "vehicle_driver_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      vehicle_owner_import_staging: {
        Row: {
          import_id: number
          imported_at: string
          owner_name: string
          vehicle_number: string
        }
        Insert: {
          import_id?: never
          imported_at?: string
          owner_name: string
          vehicle_number: string
        }
        Update: {
          import_id?: never
          imported_at?: string
          owner_name?: string
          vehicle_number?: string
        }
        Relationships: []
      }
      vehicle_owner_import_staging_backup_20261010: {
        Row: {
          import_id: number | null
          imported_at: string | null
          owner_name: string | null
          vehicle_number: string | null
        }
        Insert: {
          import_id?: number | null
          imported_at?: string | null
          owner_name?: string | null
          vehicle_number?: string | null
        }
        Update: {
          import_id?: number | null
          imported_at?: string | null
          owner_name?: string | null
          vehicle_number?: string | null
        }
        Relationships: []
      }
      vehicle_owners: {
        Row: {
          is_active: boolean
          name: string
          national_id: string | null
          owner_id: string
          phone: string | null
        }
        Insert: {
          is_active?: boolean
          name: string
          national_id?: string | null
          owner_id?: string
          phone?: string | null
        }
        Update: {
          is_active?: boolean
          name?: string
          national_id?: string | null
          owner_id?: string
          phone?: string | null
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          is_active: boolean
          owner_id: string | null
          plate_number: string
          vehicle_code: string | null
          vehicle_id: string
        }
        Insert: {
          is_active?: boolean
          owner_id?: string | null
          plate_number: string
          vehicle_code?: string | null
          vehicle_id?: string
        }
        Update: {
          is_active?: boolean
          owner_id?: string | null
          plate_number?: string
          vehicle_code?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "vehicle_owners"
            referencedColumns: ["owner_id"]
          },
        ]
      }
      waiting_list_entries: {
        Row: {
          arrived_at: string
          created_at: string
          driver_id: string
          entry_id: string
          office_id: string
          status: Database["public"]["Enums"]["waiting_status"]
          vehicle_id: string
        }
        Insert: {
          arrived_at: string
          created_at?: string
          driver_id: string
          entry_id?: string
          office_id: string
          status?: Database["public"]["Enums"]["waiting_status"]
          vehicle_id: string
        }
        Update: {
          arrived_at?: string
          created_at?: string
          driver_id?: string
          entry_id?: string
          office_id?: string
          status?: Database["public"]["Enums"]["waiting_status"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiting_list_entries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "waiting_list_entries_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "waiting_list_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_direct_assignment: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      assign_driver_vehicle: { Args: { p_vehicle_id: string }; Returns: Json }
      bind_driver_auth: { Args: { p_invitation_token: string }; Returns: Json }
      create_load_order: {
        Args: {
          p_factory_id: string
          p_priority?: number
          p_quarry_id: string
          p_requested_quantity: number
        }
        Returns: Json
      }
      create_operational_driver:
        | {
            Args: {
              p_driver_code?: string
              p_name: string
              p_phone: string
              p_plate_number: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_driver_code?: string
              p_name: string
              p_phone: string
              p_vehicle_id: string
            }
            Returns: Json
          }
      create_operational_vehicle:
        | {
            Args: {
              p_owner_name: string
              p_owner_phone?: string
              p_plate_number: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_owner_name: string
              p_owner_phone?: string
              p_plate_number: string
              p_vehicle_code: string
            }
            Returns: Json
          }
      direct_assign_standalone_load: {
        Args: {
          p_factory_id: string
          p_quarry_id: string
          p_vehicle_id: string
        }
        Returns: Json
      }
      dispatch_load: { Args: { p_load_order_id: string }; Returns: Json }
      dispatch_one_driver: { Args: { p_load_order_id: string }; Returns: Json }
      driver_arrive: {
        Args: { p_latitude: number; p_longitude: number }
        Returns: Json
      }
      driver_confirm_delivery: {
        Args: {
          p_actual_weight: number
          p_booking_id: string
          p_latitude: number
          p_longitude: number
          p_scale_image_path: string
        }
        Returns: Json
      }
      get_account_statement_records: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      get_available_driver_vehicles: {
        Args: never
        Returns: {
          plate_number: string
          vehicle_id: string
        }[]
      }
      get_available_vehicles: { Args: never; Returns: Json }
      get_branch_employee_directory: { Args: never; Returns: Json }
      get_branch_office_snapshot: { Args: never; Returns: Json }
      get_direct_assignment_trip_identity: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      get_driver_edit_options: { Args: { p_driver_id: string }; Returns: Json }
      get_driver_geofence_status: {
        Args: { p_driver_id: string }
        Returns: Json
      }
      get_driver_portal_snapshot: { Args: never; Returns: Json }
      get_office_waiting_list: { Args: never; Returns: Json }
      get_pending_direct_assignments: { Args: never; Returns: Json }
      get_phase1_snapshot: { Args: never; Returns: Json }
      get_vehicle_live_locations: { Args: never; Returns: Json }
      get_vehicle_owner_directory: { Args: never; Returns: Json }
      get_vehicle_owner_reports: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      office_cancel_booking: {
        Args: {
          p_booking_id: string
          p_reason: string
          p_vehicle_out_of_service?: boolean
        }
        Returns: Json
      }
      office_redirect_booking: {
        Args: { p_booking_id: string; p_factory_id: string; p_reason: string }
        Returns: Json
      }
      office_remove_waiting_entry: {
        Args: { p_entry_id: string; p_reason: string }
        Returns: Json
      }
      record_driver_location: {
        Args: { p_latitude: number; p_longitude: number }
        Returns: Json
      }
      set_branch_employee_active: {
        Args: { p_is_active: boolean; p_user_id: string }
        Returns: Json
      }
      update_driver_live_location: {
        Args: {
          p_accuracy_m?: number
          p_captured_at?: string
          p_heading?: number
          p_latitude: number
          p_longitude: number
          p_speed_kmh?: number
        }
        Returns: Json
      }
      update_operational_driver: {
        Args: {
          p_driver_code: string
          p_driver_id: string
          p_name: string
          p_phone: string
          p_vehicle_id: string
        }
        Returns: Json
      }
      update_operational_vehicle: {
        Args: {
          p_new_owner_name: string
          p_new_owner_phone: string
          p_owner_id: string
          p_plate_number: string
          p_vehicle_code: string
          p_vehicle_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      load_status:
        | "DRAFT"
        | "PUBLISHED"
        | "BOOKED"
        | "LOADING_STATEMENT"
        | "IN_TRANSIT"
        | "DELIVERED"
        | "COMPLETED"
        | "REJECTED"
        | "CANCELLED"
        | "NO_SHOW"
        | "FAILED"
        | "ON_HOLD"
      location_event_type:
        | "ARRIVED_GEOFENCE"
        | "LEFT_GEOFENCE"
        | "ARRIVAL_CONFIRMED"
        | "DELIVERY_CONFIRMED"
        | "LOCATION_UPDATE"
      office_type: "HEAD" | "BRANCH"
      waiting_status:
        | "WAITING"
        | "SELECTED"
        | "ASSIGNED"
        | "LEFT_QUEUE"
        | "CANCELLED"
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
      load_status: [
        "DRAFT",
        "PUBLISHED",
        "BOOKED",
        "LOADING_STATEMENT",
        "IN_TRANSIT",
        "DELIVERED",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
        "NO_SHOW",
        "FAILED",
        "ON_HOLD",
      ],
      location_event_type: [
        "ARRIVED_GEOFENCE",
        "LEFT_GEOFENCE",
        "ARRIVAL_CONFIRMED",
        "DELIVERY_CONFIRMED",
        "LOCATION_UPDATE",
      ],
      office_type: ["HEAD", "BRANCH"],
      waiting_status: [
        "WAITING",
        "SELECTED",
        "ASSIGNED",
        "LEFT_QUEUE",
        "CANCELLED",
      ],
    },
  },
} as const
