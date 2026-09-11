/**
 * EPIC-09 Team & Permissions — Zod schemas for invite, accept, role change, and api token.
 *
 * Roles are stored as `text` with a check constraint (not enum) on
 * `user_organizations.role` per project doctrine — keep this list in sync
 * with the DB constraint when adding/removing roles.
 */
import { z } from "zod";

export const ROLES = ["viewer", "agent", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Rótulo de exibição por papel (contexto de igreja). Puramente label — o papel
 * técnico (RBAC, RLS, checks) continua sendo `admin`/`manager`/`agent`/`viewer`.
 * Ver docs/decisoes.md e cajado-arquitetura.md §3.2.
 */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Pastor/Administrador",
  manager: "Líder de Ministério",
  agent: "Secretaria",
  viewer: "Leitura",
};

export const inviteMemberSchema = z.object({
  invitations: z
    .array(
      z.object({
        email: z.string().email(),
        role: z.enum(ROLES),
      }),
    )
    .min(1)
    .max(20),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(20),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const changeRoleSchema = z.object({
  role: z.enum(ROLES),
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

export const createApiTokenSchema = z.object({
  name: z.string().min(2).max(100),
  scopes: z.array(z.string()).min(1),
  expires_in_days: z.coerce.number().int().min(1).max(365).optional(),
});
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>;
