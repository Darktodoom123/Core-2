const FIELD_ROLES = new Set(['operator', 'crane_operator']);

export function isAuthorizedFieldRole(role?: string | null): boolean {
    return role ? FIELD_ROLES.has(role.toLowerCase()) : false;
}
