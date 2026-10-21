import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from './config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { CourseModule } from './course/course.module';
import { AssignmentModule } from './assignment/assignment.module';
import { QuestionModule } from './question/question.module';
import { SubmissionModule } from './submission/submission.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
      cache: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('mongodbUri'),
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      }),
    }),
    UserModule,
    AuthModule,
    CourseModule,
    AssignmentModule,
    QuestionModule,
    SubmissionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
