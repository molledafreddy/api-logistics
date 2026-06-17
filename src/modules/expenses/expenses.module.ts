import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { User } from '../auth/entities/user.entity';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { ExpenseNotificationListener } from './expense-notification.listener';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, User]), NotificationsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpenseNotificationListener],
  exports: [ExpensesService],
})
export class ExpensesModule {}
