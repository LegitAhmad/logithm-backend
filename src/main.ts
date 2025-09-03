import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<string>('port');

  const config = new DocumentBuilder()
    .setTitle('Logithm API')
    .setDescription('The API for Logithm')
    .setVersion('1.0')
    .addTag('logithm')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, documentFactory);

  await app.listen(port!);
  console.log(`The server is running at port ${port}.`);
}
void bootstrap();
