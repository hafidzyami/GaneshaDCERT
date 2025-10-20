/**
 * Admin Authentication DTOs
 */

export interface AdminLoginDTO {
  email: string;
  password: string;
}

export interface CreateAdminDTO {
  email: string;
  password: string;
  name: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface AdminResponseDTO {
  id: string;
  email: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AdminLoginResponseDTO {
  token: string;
  admin: AdminResponseDTO;
}
