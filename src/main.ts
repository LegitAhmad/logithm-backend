import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { cleanupOpenApiDoc } from 'nestjs-zod';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<string>('port');

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
      'access-token', // This name here is important for matching with @ApiBearerAuth()
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, cleanupOpenApiDoc(document));

  await app.listen(port!);
  console.log(`The server is running at port ${port}.`);
}
void bootstrap();
