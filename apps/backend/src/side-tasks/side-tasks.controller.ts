import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { SideTasksService } from './side-tasks.service';
import {
  AbandonSideTaskDto,
  CreateSideTaskDto,
  CreateSideTaskStageTypeDto,
  PassStageDto,
  ReassignStageDto,
  SendBackReviewDto,
  SubmitReviewDto,
  UpdateSideTaskDto,
  UpdateSideTaskStageTypeDto,
} from './dto/side-tasks.dto';
import { SideTaskPriority, SideTaskStatus } from '@prisma/client';

@Controller('side-tasks')
export class SideTasksController {
  constructor(private readonly sideTasksService: SideTasksService) {}

  /* ========================================================================
   * STAGE TYPES ENDPOINTS
   * ======================================================================== */

  @Post('stage-types')
  @Permissions('side_tasks:edit')
  createStageType(@Body() dto: CreateSideTaskStageTypeDto) {
    return this.sideTasksService.createStageType(dto);
  }

  @Get('stage-types')
  @Permissions('side_tasks:view')
  findAllStageTypes() {
    return this.sideTasksService.findAllStageTypes();
  }

  @Patch('stage-types/:id')
  @Permissions('side_tasks:edit')
  updateStageType(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSideTaskStageTypeDto,
  ) {
    return this.sideTasksService.updateStageType(id, dto);
  }

  /* ========================================================================
   * TASK QUERY ENDPOINTS
   * ======================================================================== */

  @Post()
  @Permissions('side_tasks:create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSideTaskDto) {
    return this.sideTasksService.create(user.id, dto);
  }

  @Get('my')
  @Permissions('side_tasks:view')
  getMine(@CurrentUser() user: AuthUser) {
    return this.sideTasksService.getMine(user.id);
  }

  @Get('all')
  @Permissions('side_tasks:view_all')
  getAll(
    @Query('status') status?: SideTaskStatus,
    @Query('customerId') customerId?: string,
    @Query('priority') priority?: SideTaskPriority,
    @Query('stageTypeId') stageTypeId?: string,
    @Query('search') search?: string,
  ) {
    return this.sideTasksService.getAll({
      status,
      customerId,
      priority,
      stageTypeId,
      search,
    });
  }

  @Get('completed')
  @Permissions('side_tasks:view')
  getCompleted() {
    return this.sideTasksService.getCompleted();
  }

  @Get(':id')
  @Permissions('side_tasks:view')
  getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.sideTasksService.getOne(id);
  }

  @Patch(':id')
  @Permissions('side_tasks:edit')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSideTaskDto,
  ) {
    return this.sideTasksService.update(id, dto);
  }

  /* ========================================================================
   * WORKFLOW STAGE ACTIONS ENDPOINTS
   * ======================================================================== */

  @Post(':id/stages/start')
  @Permissions('side_tasks:edit')
  startStage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sideTasksService.startStage(id, user.id);
  }

  @Post(':id/stages/pause')
  @Permissions('side_tasks:edit')
  pauseStage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sideTasksService.pauseStage(id, user.id);
  }

  @Post(':id/stages/resume')
  @Permissions('side_tasks:edit')
  resumeStage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sideTasksService.resumeStage(id, user.id);
  }

  @Post(':id/stages/pass')
  @Permissions('side_tasks:assign')
  passStage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: PassStageDto,
  ) {
    return this.sideTasksService.passStage(id, user.id, dto);
  }

  @Post(':id/stages/reassign')
  @Permissions('side_tasks:assign')
  reassignStage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReassignStageDto,
  ) {
    return this.sideTasksService.reassignStage(id, user.id, dto);
  }

  @Post(':id/review/submit')
  @Permissions('side_tasks:edit')
  submitReview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.sideTasksService.submitReview(id, user.id, dto);
  }

  @Post(':id/review/approve')
  @Permissions('side_tasks:review')
  approveReview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sideTasksService.approveReview(id, user.id);
  }

  @Post(':id/review/send-back')
  @Permissions('side_tasks:review')
  sendBackReview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SendBackReviewDto,
  ) {
    return this.sideTasksService.sendBackReview(id, user.id, dto);
  }

  @Post(':id/abandon')
  @Permissions('side_tasks:abandon')
  abandonTask(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AbandonSideTaskDto,
  ) {
    return this.sideTasksService.abandonTask(id, user.id, dto);
  }

  @Delete(':id')
  @Permissions('side_tasks:abandon', 'side_tasks:edit', 'side_tasks:delete')
  deleteTask(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.sideTasksService.delete(id);
  }
}
