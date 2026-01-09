import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { WebhooksService } from './webhooks.service';
import { WebhookSecurityService } from './webhook-security.service';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  providers: [WebhooksService, WebhookSecurityService, SupabaseService],
  exports: [WebhooksService, WebhookSecurityService, SupabaseService],
})
export class WebhooksModule {}