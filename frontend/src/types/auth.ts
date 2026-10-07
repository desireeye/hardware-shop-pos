export type RoleName = 'ADMIN' | 'STAFF';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  mustChangePassword?: boolean;
  isActive?: boolean;
  lastLoginAt?: string | null;
};

export type LoginResponse = {
  success: boolean;
  message: string;
  user: AuthUser;
  requiresPasswordChange?: boolean;
};

export type ApiError = {
  success: false;
  message: string;
  errorCode?: string;
};
