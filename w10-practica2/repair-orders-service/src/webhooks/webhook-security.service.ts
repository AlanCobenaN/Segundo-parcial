import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSecurityService {
 generateSignature(payload: any, secret: string): string {
 // 1. Serializar payload a JSON string (sin espacios)
 const payloadString = JSON.stringify(payload);

 // 2. Crear HMAC con SHA256
 const hmac = crypto
 .createHmac('sha256', secret)
 .update(payloadString)
 .digest('hex');

 // 3. Retornar con prefijo estándar
 return `sha256=${hmac}`;
 }

 generateTimestamp(): string {
 return Math.floor(Date.now() / 1000).toString();
 }
}