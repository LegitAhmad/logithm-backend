import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Assignment,
  AssignmentDocument,
  AssignmentStatus,
} from './schemas/assignment.schema';
import {
  AssignmentQueryDto,
  AssignmentResponseDto,
  CreateAssignmentDto,
  PublishAssignmentDto,
  UpdateAssignmentDto,
} from './DTOs/assignment.dto';
import { ResourceAccessService } from '../access/resource-access.service';

type AssignmentRealStatus = 'draft' | 'pending' | 'active' | 'missed';

@Injectable()
export class AssignmentService {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    private readonly access: ResourceAccessService,
  ) {}

  /* ---------------------------------- Helpers ---------------------------------- */

  private assertOwner(assignment: AssignmentDocument, userId: string) {
    if (assignment.ownerId.toString() !== userId.toString()) {
      throw new ForbiddenException();
    }
  }

  private computeStatus(assignment: AssignmentDocument): AssignmentRealStatus {
    const now = new Date();

    if (assignment.status === AssignmentStatus.DRAFT)
      return AssignmentStatus.DRAFT;

    if (assignment.deadline && now > assignment.deadline) return 'missed';

    if (assignment.startAt && now < assignment.startAt) return 'pending';

    return 'active';
  }

  private format(assignment: AssignmentDocument): AssignmentResponseDto {
    const realStatus = this.computeStatus(assignment);

    return {
      _id: assignment._id.toString(),
      ownerId: assignment.ownerId.toString(),
      title: assignment.title,
      description: assignment.description ?? null,
      courseId: assignment.courseId.toString(),
      questionIds: assignment.questionIds.map((id) => id.toString()),
      status: assignment.status,
      publishedAt: assignment.publishedAt?.toISOString() ?? null,
      startAt: assignment.startAt?.toISOString() ?? null,
      deadline: assignment.deadline?.toISOString() ?? null,
      realStatus,
      isActive: realStatus === 'active',
      isExpired: realStatus === 'missed',
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
    };
  }

  private matchesQueryStatus(
    assignment: AssignmentDocument,
    status?: AssignmentQueryDto['status'],
  ) {
    if (!status) return true;

    const realStatus = this.computeStatus(assignment);

    switch (status) {
      case 'published':
        return realStatus === 'pending';
      case 'closed':
        return realStatus === 'missed';
      default:
        return realStatus === status;
    }
  }

  private paginateAssignments(
    assignments: AssignmentDocument[],
    query?: AssignmentQueryDto,
  ) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;

    const refinedAssignments = assignments
      .filter((assignment) =>
        this.matchesQueryStatus(assignment, query?.status),
      )
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );

    const offset = (page - 1) * limit;

    return refinedAssignments.slice(offset, offset + limit);
  }

  /* ---------------------------------- Queries ---------------------------------- */

  async getByOwner(
    userId: string,
    query?: AssignmentQueryDto,
  ): Promise<AssignmentResponseDto[]> {
    const criteria: Record<string, unknown> = {
      ownerId: userId,
    };

    if (query?.courseId) {
      await this.access.courseAccess(query.courseId, userId);
      criteria.courseId = query.courseId;
    }

    const list = await this.assignmentModel.find(criteria);

    const refinedList = this.paginateAssignments(
      list as AssignmentDocument[],
      query,
    ).map((a) => this.format(a));
    return refinedList;
  }

  async getByCourse(courseId: string, userId: string, query?: AssignmentQueryDto) {
    const { teacher } = await this.access.courseAccess(courseId, userId);
    const list = await this.assignmentModel.find({
      courseId,
      $or: teacher ? [{ status: { $ne: AssignmentStatus.DRAFT } }, { ownerId: userId }] : [{ status: { $ne: AssignmentStatus.DRAFT } }],
    });

    return this.paginateAssignments(list as AssignmentDocument[], query).map(
      (a) => this.format(a),
    );
  }

  async getOne(id: string, userId: string) {
    const assignment = await this.assignmentModel.findById(id);

    if (!assignment) {
      throw new NotFoundException();
    }

    await this.access.assertAssignmentAccess(assignment, userId);

    return this.format(assignment as AssignmentDocument);
  }

  /* --------------------------------- Mutations --------------------------------- */

  async create(dto: CreateAssignmentDto, userId: string) {
    await this.access.assertCourseTeacher(dto.courseId, userId);
    await this.access.assertAttachableQuestions(dto.questionIds ?? [], userId);
    const assignment = await this.assignmentModel.create({
      title: dto.title,
      description: dto.description,
      courseId: new Types.ObjectId(dto.courseId),
      questionIds: dto.questionIds?.map((id) => new Types.ObjectId(id)),
      ownerId: new Types.ObjectId(userId),
      status: AssignmentStatus.DRAFT,
    });

    return this.format(assignment as AssignmentDocument);
  }

  async updateDraft(id: string, dto: UpdateAssignmentDto, userId: string) {
    const assignment = await this.assignmentModel.findById(id);

    if (!assignment) throw new NotFoundException();

    this.assertOwner(assignment as AssignmentDocument, userId);
    await this.access.assertCourseTeacher(assignment.courseId.toString(), userId);
    if (dto.questionIds) await this.access.assertAttachableQuestions(dto.questionIds, userId);

    if (assignment.status !== AssignmentStatus.DRAFT) {
      throw new BadRequestException('Only drafts can be edited');
    }

    if (dto.title !== undefined) assignment.title = dto.title;
    if (dto.description !== undefined) assignment.description = dto.description;
    if (dto.questionIds !== undefined) assignment.questionIds = dto.questionIds.map(id => new Types.ObjectId(id));

    await assignment.save();

    return this.format(assignment as AssignmentDocument);
  }

  async publish(id: string, dto: PublishAssignmentDto, userId: string) {
    const assignment = await this.assignmentModel.findById(id);

    if (!assignment) throw new NotFoundException();

    this.assertOwner(assignment as AssignmentDocument, userId);
    await this.access.assertCourseTeacher(assignment.courseId.toString(), userId);
    await this.access.assertAttachableQuestions(assignment.questionIds.map(String), userId);
    if (!assignment.questionIds.length) throw new BadRequestException('Add at least one question before publishing');

    if (assignment.status !== AssignmentStatus.DRAFT) {
      throw new BadRequestException('Already published');
    }

    const now = new Date();

    const publishedAt = now;

    const startAt = dto.startAt ? new Date(dto.startAt) : publishedAt;

    if (startAt < publishedAt) {
      throw new BadRequestException('Invalid start time');
    }

    let deadline: Date | undefined;

    if (dto.deadline) {
      deadline = new Date(dto.deadline);

      if (deadline <= startAt) {
        throw new BadRequestException('Invalid deadline');
      }
    }

    assignment.status = AssignmentStatus.PUBLISHED;
    assignment.publishedAt = publishedAt;
    assignment.startAt = startAt;
    assignment.deadline = deadline;

    await assignment.save();

    return this.format(assignment as AssignmentDocument);
  }

  async unpublish(id: string, userId: string) {
    const assignment = await this.assignmentModel.findById(id);

    if (!assignment) throw new NotFoundException();

    this.assertOwner(assignment as AssignmentDocument, userId);
    await this.access.assertCourseTeacher(assignment.courseId.toString(), userId);

    if (assignment.status !== AssignmentStatus.PUBLISHED) {
      throw new BadRequestException('Cannot unpublish now');
    }

    // Do not allow if already active
    if (assignment.startAt && new Date() >= assignment.startAt) {
      throw new BadRequestException('Assignment already started');
    }

    assignment.status = AssignmentStatus.DRAFT;
    assignment.publishedAt = undefined;
    assignment.startAt = undefined;
    assignment.deadline = undefined;

    await assignment.save();

    return this.format(assignment as AssignmentDocument);
  }

  async deleteDraft(id: string, userId: string) {
    const assignment = await this.assignmentModel.findById(id);

    if (!assignment) throw new NotFoundException();

    this.assertOwner(assignment as AssignmentDocument, userId);
    await this.access.assertCourseTeacher(assignment.courseId.toString(), userId);

    if (assignment.status !== AssignmentStatus.DRAFT) {
      throw new BadRequestException('Only drafts can be deleted');
    }

    await assignment.deleteOne();

    return { success: true };
  }
}
