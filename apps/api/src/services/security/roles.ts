export const Roles = {
  ADMIN: "ADMIN",
  USER: "USER"
} as const;

export type Role = typeof Roles[keyof typeof Roles];

export const Permissions = {
  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  USERS_DELETE: "users:delete",
  AUDIT_READ: "audit:read",
  SELF_MANAGE: "self:manage"
} as const;

export type Permission = typeof Permissions[keyof typeof Permissions];

export const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: [Permissions.USERS_READ, Permissions.USERS_WRITE, Permissions.USERS_DELETE, Permissions.AUDIT_READ, Permissions.SELF_MANAGE],
  USER: [Permissions.SELF_MANAGE]
};
