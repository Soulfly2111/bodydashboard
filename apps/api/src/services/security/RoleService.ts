import { Permissions, Roles, rolePermissions } from "./roles.js";

export class RoleService {
  listRoles() {
    return Object.values(Roles).map((role) => ({ role, permissions: rolePermissions[role] }));
  }

  listPermissions() {
    return Object.values(Permissions);
  }
}
