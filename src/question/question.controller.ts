import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { ZodValidationPipe } from 'nestjs-zod';
import { QuestionService } from './question.service';
import { CreateQuestionDto, UpdateQuestionDto } from './DTOs/question.dto';
import { CurrentUser } from 'src/utils/decorators/create-param.decorator';
import type { UserDto } from 'src/user/DTOs/user.dto';

@Controller('questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body(new ZodValidationPipe())
    dto: CreateQuestionDto,
    @CurrentUser() user: UserDto,
  ) {
    return this.questionService.create(dto, user._id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async getMine(@CurrentUser() user: UserDto) {
    return this.questionService.findByOwner(user._id);
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() user?: UserDto) {
    return this.questionService.findOne(id, user?._id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe())
    dto: UpdateQuestionDto,
    @CurrentUser() user: UserDto,
  ) {
    return this.questionService.update(id, dto, user._id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return this.questionService.remove(id, user._id);
  }
}
