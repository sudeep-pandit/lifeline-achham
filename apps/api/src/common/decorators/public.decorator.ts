import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

// Usage: @Public() on login, register-application, QR-verification routes.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
