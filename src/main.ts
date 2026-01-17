import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Bootstrap the NestJS application.
 * Configures global validation pipe, Swagger documentation, and starts the server.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS for frontend
  app.enableCors();

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Fantasy Roguelike API')
    .setDescription(
      'Battle simulator API for roguelike autobattler games. ' +
        'Supports run progression, draft mechanics, unit upgrades, and async PvP matchmaking. ' +
        'All battles include Core 2.0 mechanic events (facing, flanking, riposte, charge, resolve, etc.).',
    )
    .setVersion('1.0')
    .addTag('run', 'Run management endpoints')
    .addTag('battle', 'Battle simulation endpoints')
    .addTag('draft', 'Card drafting endpoints')
    .addTag('upgrade', 'Unit upgrade endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Application running on port ${port}`);
  logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();
