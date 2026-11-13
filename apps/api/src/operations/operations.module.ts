import { Controller, Post, UseGuards, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ScheduleModule } from "@nestjs/schedule";
import { OperationsService } from "./operations.service";
import { Roles } from "../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../common/guards";

@ApiTags("operations")
@Controller("admin/operations")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@ApiBearerAuth()
export class OperationsController {
  constructor(private ops: OperationsService) {}

  @Post("run-abandoned-carts")
  async runAbandonedCarts() {
    return this.ops._runAbandonedCartReminders();
  }

  @Post("run-stuck-orders")
  async runStuckOrders() {
    return this.ops._runStuckOrderDigest();
  }

  @Post("run-all")
  async runAll() {
    const [abandoned, stuck] = await Promise.all([this.ops._runAbandonedCartReminders(), this.ops._runStuckOrderDigest()]);
    return { abandoned, stuck };
  }
}

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [OperationsService],
  controllers: [OperationsController],
})
export class OperationsModule {}
