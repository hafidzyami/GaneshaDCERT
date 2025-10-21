/**
 * Services Index
 * Central export point for all services
 */

// Export default singleton instances
export { default as AuthService } from "./auth.service";
export { default as AdminAuthService } from "./adminAuth.service";
export { default as DIDService } from "./did.service";
export { default as CredentialService } from "./credential.service";
export { default as SchemaService } from "./schema.service";
export { default as PresentationService } from "./presentation.service";
export { default as NotificationService } from "./notification.service";
export { default as DIDBlockchainService } from "./blockchain/didBlockchain.service";
export { default as VCBlockchainService } from "./blockchain/vcBlockchain.service";
export * from "./jwt.service";
export * from "./email.service";

// Export classes for custom instantiation and testing
export { AuthService as AuthServiceClass } from "./auth.service";
export { AdminAuthService as AdminAuthServiceClass } from "./adminAuth.service";
export { DIDService as DIDServiceClass } from "./did.service";
export { CredentialService as CredentialServiceClass } from "./credential.service";
export { SchemaService as SchemaServiceClass } from "./schema.service";
export { PresentationService as PresentationServiceClass } from "./presentation.service";
export { NotificationService as NotificationServiceClass } from "./notification.service";
export { DIDBlockchainService as DIDBlockchainServiceClass } from "./blockchain/didBlockchain.service";
export { VCBlockchainService as VCBlockchainServiceClass } from "./blockchain/vcBlockchain.service";
