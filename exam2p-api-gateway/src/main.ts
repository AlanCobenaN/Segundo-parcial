import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('GatewayMain');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe());
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 API Gateway corriendo en http://localhost:${port}`);
  logger.log(`📍 Endpoint: POST http://localhost:${port}/exam2p-auditoria/consultar-ia`);
  logger.log(`📍 Endpoint: GET http://localhost:${port}/exam2p-auditoria`);
}

bootstrap();