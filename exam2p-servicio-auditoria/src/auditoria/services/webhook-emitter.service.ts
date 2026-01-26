import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { WebhookPayloadDto } from '../dto/webhook-payload.dto';

@Injectable()
export class WebhookEmitterService {
  private readonly logger = new Logger(WebhookEmitterService.name);
  private readonly webhookUrl: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.webhookUrl = this.configService.get<string>('N8N_WEBHOOK_URL');
    this.logger.log(`📡 Webhook URL configurada: ${this.webhookUrl}`);
  }

  async emitir(payload: WebhookPayloadDto): Promise<void> {
    // Copiamos a una variable local para que TypeScript pueda estrechar el tipo después del chequeo
    const webhookUrl = this.webhookUrl;
    if (!webhookUrl) {
      this.logger.warn('⚠️ N8N_WEBHOOK_URL no configurada. Webhook no enviado.');
      return;
    }

    try {
      this.logger.log(`🚀 Enviando webhook: ${payload.evento}`);
      this.logger.debug(`📦 Payload: ${JSON.stringify(payload, null, 2)}`);

      const response = await firstValueFrom(
        this.httpService.post(webhookUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        })
      );

      this.logger.log(`✅ Webhook enviado exitosamente. Status: ${response.status}`);
      this.logger.debug(`📨 Respuesta: ${JSON.stringify(response.data)}`);

    } catch (error: any) {
      this.logger.error(`❌ Error enviando webhook: ${error?.message ?? error}`);

      if (error?.response) {
        this.logger.error(`Status: ${error.response.status}`);
        this.logger.error(`Data: ${JSON.stringify(error.response.data)}`);
      } else if (error?.code === 'ECONNREFUSED') {
        this.logger.error('🔌 No se pudo conectar a n8n. ¿Está corriendo?');
      }

      // No lanzar error para no bloquear el flujo de auditoría
      this.logger.warn('⚠️ Auditoría guardada, pero webhook falló');
    }
  }
}
