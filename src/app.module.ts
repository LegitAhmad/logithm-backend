import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import config from './config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { CourseModule } from './course/course.module';
import { AssignmentController } from './assignment/assignment.controller';
import { AssignmentService } from './assignment/assignment.service';
import { QuestionController } from './question/question.controller';
import { QuestionService } from './question/question.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
      expandVariables: true,
    }),
    MongooseModule.forRoot(config().mongodbUri),
    UserModule,
    AuthModule,
    CourseModule,
  ],
  controllers: [AppController, AssignmentController, QuestionController],
  providers: [AppService, AssignmentService, QuestionService],
})
export class AppModule {}
