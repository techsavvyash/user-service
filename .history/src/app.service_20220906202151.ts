import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}
  getHello(): string {
    const dbUser  = this.configService.get<string>('port');
    const objNew = JSON.parse(dbUser);
    return `Hello World! ${typeof dbUser}`;
  }
}
