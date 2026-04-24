import { UserRole } from '../enums/user-role.enum';

export interface IUserPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  companyId: string | null;
  iat?: number;
  exp?: number;
}
