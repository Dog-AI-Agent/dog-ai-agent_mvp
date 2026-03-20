import { get, put, post } from "./client";
import type { AuthUser } from "../context/AuthContext";

export interface DogInfo {
  dog_id: string;
  user_id: string;
  name: string;
  birthday?: string | null;
  breed_id?: string | null;
  breed_name_ko?: string | null;
  favorite_ingredients: string[];
  created_at: string;
}

export interface UserUpdatePayload {
  name?: string;
  nickname?: string;
  birth_date?: string;
  address?: string;
}

export interface DogPayload {
  name: string;
  birthday?: string;
  breed_id?: string;
  favorite_ingredients?: string[];
}

export const getMe = (): Promise<AuthUser> =>
  get<AuthUser>("/users/me");

export const updateMe = (payload: UserUpdatePayload): Promise<AuthUser> =>
  put<AuthUser>("/users/me", JSON.stringify(payload), { "Content-Type": "application/json" });

export const getMyDog = (): Promise<DogInfo | null> =>
  get<DogInfo | null>("/users/me/dog");

export const createMyDog = (payload: DogPayload): Promise<DogInfo> =>
  post<DogInfo>("/users/me/dog", JSON.stringify(payload), { "Content-Type": "application/json" });

export const updateMyDog = (payload: Partial<DogPayload>): Promise<DogInfo> =>
  put<DogInfo>("/users/me/dog", JSON.stringify(payload), { "Content-Type": "application/json" });
