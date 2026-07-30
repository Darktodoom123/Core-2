const FIELD_ROLES = new Set(['driver', 'crane_operator', 'field_technician']);

export function isAuthorizedFieldRole(role?: string | null): boolean {
    return role ? FIELD_ROLES.has(role.toLowerCase()) : false;
}
