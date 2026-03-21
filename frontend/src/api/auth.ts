import { post } from "./client";
import type { AuthUser } from "../context/AuthContext";

interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface SignupPayload {
  name: string;
  email: string;
  nickname: string;
  password: string;
  birth_date?: string;
  address?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const signup = (payload: SignupPayload): Promise<TokenResponse> =>
  post<TokenResponse>("/auth/signup", JSON.stringify(payload), {
    "Content-Type": "application/json",
  });

export const login = (payload: LoginPayload): Promise<TokenResponse> =>
  post<TokenResponse>("/auth/login", JSON.stringify(payload), {
    "Content-Type": "application/json",
  });
