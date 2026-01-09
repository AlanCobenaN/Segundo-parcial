import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../webhooks/supabase.service';
import { createHash } from 'crypto';

/**
 * Servicio de Idempotencia para garantizar procesamiento "Exactly-once"
 * a pesar de que RabbitMQ garantiza "At-least-once delivery"
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly TTL_DAYS = 7;

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Genera una clave de idempotencia única basada en:
   * action + entity_id + datos relevantes
   */
  generateKey(action: string, entityId: string, additionalData?: Record<string, any>): string {
    const baseKey = `${action}-${entityId}`;
    
    if (additionalData) {
      // Hash de datos adicionales para evitar claves muy largas
      const dataHash = createHash('md5')
        .update(JSON.stringify(additionalData))
        .digest('hex')
        .substring(0, 8);
      return `${baseKey}-${dataHash}`;
    }
    
    return baseKey;
  }

  /**
   * Verifica si una operación ya fue procesada
   * @returns El resultado almacenado si existe, null si no
   */
  async checkProcessed(idempotencyKey: string): Promise<unknown> {
    try {
      const supabase = this.supabaseService.supabase;
      if (!supabase) {
        this.logger.warn('Supabase not initialized, skipping idempotency check');
        return null;
      }

      const { data, error } = await supabase
        .from('processed_messages')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (error) {
        // No existe o error de consulta
        if (error.code === 'PGRST116') {
          // No rows found - es correcto, no se ha procesado
          return null;
        }
        this.logger.error(`Error checking idempotency: ${error.message}`);
        return null;
      }

      if (data) {
        this.logger.warn(`🔄 Mensaje duplicado detectado: ${idempotencyKey}`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return data.result;
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Failed to check idempotency: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }

  /**
   * Marca una operación como procesada y almacena el resultado
   */
  async markAsProcessed(
    idempotencyKey: string,
    action: string,
    entityId: string,
    result: unknown
  ): Promise<void> {
    try {
      const supabase = this.supabaseService.supabase;
      if (!supabase) {
        this.logger.warn('Supabase not initialized, skipping idempotency store');
        return;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.TTL_DAYS);

      const { error } = await supabase
        .from('processed_messages')
        .insert({
          idempotency_key: idempotencyKey,
          action,
          entity_id: entityId,
          result: result as Record<string, unknown>,
          processed_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        });

      if (error) {
        this.logger.error(`Error storing idempotency: ${error.message}`);
      } else {
        this.logger.debug(`💾 Idempotency key stored: ${idempotencyKey}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to store idempotency: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Limpia claves expiradas (puede ejecutarse como cron job)
   */
  async cleanExpiredKeys(): Promise<number> {
    try {
      const supabase = this.supabaseService.supabase;
      if (!supabase) {
        return 0;
      }

      const { data, error } = await supabase
        .from('processed_messages')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select();

      if (error) {
        this.logger.error(`Error cleaning expired keys: ${error.message}`);
        return 0;
      }

      const count = data?.length ?? 0;
      if (count > 0) {
        this.logger.log(`🗑️  Cleaned ${count} expired idempotency keys`);
      }
      
      return count;
    } catch (error) {
      this.logger.error(
        `Failed to clean expired keys: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return 0;
    }
  }
}
