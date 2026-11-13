export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export interface AuthSession {
  token: string;
  token_type: 'Bearer';
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}
