import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

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

type AssignmentRealStatus = 'draft' | 'pending' | 'active' | 'missed';

@Injectable()
export class AssignmentService {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
  ) {}

  /* ---------------------------------- Helpers ---------------------------------- */

  private assertOwner(assignment: AssignmentDocument, userId: string) {
    if (!assignment.ownerId.equals(userId)) {
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
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime(),
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
      criteria.courseId = query.courseId;
    }

    const list = await this.assignmentModel.find(criteria);

    const refinedList = this.paginateAssignments(
      list as AssignmentDocument[],
      query,
    ).map((a) => this.format(a as AssignmentDocument));
    return refinedList;
  }

  async getByCourse(courseId: string, query?: AssignmentQueryDto) {
    const list = await this.assignmentModel.find({
      courseId,
      status: { $ne: AssignmentStatus.DRAFT },
    });

    return this.paginateAssignments(list as AssignmentDocument[], query).map(
      (a) => this.format(a as AssignmentDocument),
    );
  }

  async getOne(id: string, userId: string) {
    const assignment = await this.assignmentModel.findById(id);

    if (!assignment) {
      throw new NotFoundException();
    }

    // Draft visible only to owner
    if (
      assignment.status === AssignmentStatus.DRAFT &&
      !assignment.ownerId.equals(userId)
    ) {
      throw new ForbiddenException();
    }

    return this.format(assignment as AssignmentDocument);
  }

  /* --------------------------------- Mutations --------------------------------- */

  async create(dto: CreateAssignmentDto, userId: string) {
    const assignment = await this.assignmentModel.create({
      ...dto,
      ownerId: userId,
      status: AssignmentStatus.DRAFT,
    });

    return this.format(assignment as AssignmentDocument);
  }

  async updateDraft(id: string, dto: UpdateAssignmentDto, userId: string) {
    const assignment = await this.assignmentModel.findById(id);

    if (!assignment) throw new NotFoundException();

    this.assertOwner(assignment as AssignmentDocument, userId);

    if (assignment.status !== AssignmentStatus.DRAFT) {
      throw new BadRequestException('Only drafts can be edited');
    }

    Object.assign(assignment, dto);

    await assignment.save();

    return this.format(assignment as AssignmentDocument);
  }

  async publish(id: string, dto: PublishAssignmentDto, userId: string) {
    const assignment = await this.assignmentModel.findById(id);

    if (!assignment) throw new NotFoundException();

    this.assertOwner(assignment as AssignmentDocument, userId);

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

    if (assignment.status !== AssignmentStatus.DRAFT) {
      throw new BadRequestException('Only drafts can be deleted');
    }

    await assignment.deleteOne();

    return { success: true };
  }
}
