import { Body, Controller, Get, Post, Request, UseGuards} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateWorkspaceDto } from './workspaces.dto';
import { WorkspacesService } from './workspaces.service';

@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  createWorkspace(@Body() dto: CreateWorkspaceDto, @Request() req) {
    return this.workspacesService.createWorkspace(dto, req.user.id);
  }

  @Get()
  getWorkspaces(@Request() req) {
    return this.workspacesService.getUserWorkspaces(req.user.id);
  }
}
