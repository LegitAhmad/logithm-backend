import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '6mb' });
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('port');

  app.use(cookieParser());

  const config = new DocumentBuilder()
    .setTitle('Logithm API')
    .setDescription('The API for Logithm')
    .setVersion('1.0')
    .addTag('logithm')
    .addBearerAuth(
      {
        // Description for the field in Swagger UI
        description: `Please enter token in following format: Bearer <JWT>`,
        name: 'Authorization',
        bearerFormat: 'Bearer', // Optional, arbitrary value for documentation
        scheme: 'Bearer',
        type: 'http', // 'http' for bearer auth
        in: 'header',
      },
      'jwt-auth', // This name here is important for matching with @ApiBearerAuth()
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, cleanupOpenApiDoc(document));

  app.enableShutdownHooks();

  app.enableCors({
    origin: configService.get<string[]>('corsOrigins'),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(port, '0.0.0.0');
  console.log(`The server is listening on port ${port}.`);
}
void bootstrap().catch(() => {
  // Nest logs startup failures; do not dump config values or connection strings.
  console.error('Startup failed. Check required configuration, MongoDB connectivity and port availability.');
  process.exitCode = 1;
});
