import { rolePermissions, type Permission, type Role } from "./roles.js";

export class PermissionService {
  has(role: string | undefined, permission: Permission) {
    return role ? (rolePermissions[role as Role] ?? []).includes(permission) : false;
  }

  permissionsFor(role: string | undefined) {
    return role ? rolePermissions[role as Role] ?? [] : [];
  }
}
