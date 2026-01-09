import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  public supabase: SupabaseClient; // Cambiar a public para acceso desde IdempotencyService

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

  private initializeClient() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('⚠️  Supabase credentials not found.');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    this.logger.log('✅ Supabase client initialized');
  }

  /**
   * Obtiene suscripciones activas de webhooks desde la BD
   */
  async getActiveSubscriptions(eventType?: string) {
    try {
      if (!this.supabase) {
        return [];
      }

      let query = this.supabase
        .from('webhook_subscriptions')
        .select('*')
        .eq('is_active', true);

      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error(`Error fetching subscriptions: ${error.message}`);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Failed to fetch subscriptions`);
      return [];
    }
  }

  /**
   * Guarda el resultado de un intento de entrega de webhook
   */
  async saveDeliveryLog(deliveryData: {
    subscription_id: number;
    event_id: string;
    attempt_number: number;
    status: 'success' | 'failed';
    status_code: number | null;
    error_message: string | null;
    duration_ms: number;
  }): Promise<void> {
    try {
      if (!this.supabase) {
        this.logger.warn('Supabase not initialized, skipping delivery log');
        return;
      }

      const { error } = await this.supabase
        .from('webhook_deliveries')
        .insert({
          subscription_id: deliveryData.subscription_id,
          event_id: deliveryData.event_id,
          attempt_number: deliveryData.attempt_number,
          status: deliveryData.status,
          status_code: deliveryData.status_code,
          error_message: deliveryData.error_message,
          duration_ms: deliveryData.duration_ms,
          delivered_at: new Date().toISOString(),
        });

      if (error) {
        this.logger.error(`Error saving delivery log: ${error.message}`);
      } else {
        this.logger.debug(`💾 Delivery log saved for event ${deliveryData.event_id}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to save delivery log: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
