import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getServiceInfo() {
    return { service: 'logithm-api', version: '1.0' };
  }

  @Get('health/live')
  getLiveness() {
    return { status: 'ok' };
  }

  @Get('health/ready')
  getReadiness() {
    return this.appService.getReadiness();
  }
}
