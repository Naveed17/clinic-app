import { Module } from '@nestjs/common';
import { HostedAiController } from './ai.controller';
import { HostedWhatsAppController } from './whatsapp.controller';

@Module({
  controllers: [HostedAiController, HostedWhatsAppController],
})
export class HostedServicesModule {}
