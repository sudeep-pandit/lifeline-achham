"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api-client";
import { useAuth } from "../../../../lib/auth-context";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { StatusBadge } from "../../../../components/ui/badge";
import type { UserListItemDto, RoleDto, PermissionCatalogItemDto, UserStatus } from "@lifeline/types";

type Tab = "users" | "roles";
const BLANK_ROLE_FORM = { id: null as string | null, name: "", description: "", permissionKeys: [] as string[] };

export default function UsersRolesPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserListItemDto[] | null>(null);
  const [roles, setRoles] = useState<RoleDto[] | null>(null);
  const [permissions, setPermissions] = useState<PermissionCatalogItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const [userForm, setUserForm] = useState({ fullName: "", email: "", password: "", roleIds: [] as string[] });
  const [roleForm, setRoleForm] = useState(BLANK_ROLE_FORM);

  function loadAll() {
    apiFetch<UserListItemDto[]>("/users").then(setUsers).catch(() => setError("Unable to load users. You may not have permission to view this page."));
    apiFetch<RoleDto[]>("/roles").then(setRoles).catch(() => {});
    if (can("roles.manage")) {
      apiFetch<PermissionCatalogItemDto[]>("/permissions").then(setPermissions).catch(() => {});
    }
  }

  useEffect(loadAll, []);

  async function createUser() {
    if (!userForm.fullName || !userForm.email || userForm.password.length < 8 || userForm.roleIds.length === 0) {
      setError("Fill in name, email, an 8+ character password, and select at least one role.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/users", { method: "POST", body: JSON.stringify(userForm) });
      setUserForm({ fullName: "", email: "", password: "", roleIds: [] });
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create this user.");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(userId: string, status: UserStatus) {
    setStatusUpdating(userId);
    setError(null);
    try {
      await apiFetch(`/users/${userId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update this user's status.");
    } finally {
      setStatusUpdating(null);
    }
  }

  function editRole(r: RoleDto) {
    setRoleForm({ id: r.id, name: r.name, description: r.description ?? "", permissionKeys: r.permissions });
    setTab("roles");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveRole() {
    if (!roleForm.name || roleForm.permissionKeys.length === 0) {
      setError("Give the role a name and select at least one permission.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = { name: roleForm.name, description: roleForm.description, permissionKeys: roleForm.permissionKeys };
      if (roleForm.id) {
        await apiFetch(`/roles/${roleForm.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/roles", { method: "POST", body: JSON.stringify(body) });
      }
      setRoleForm(BLANK_ROLE_FORM);
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save this role.");
    } finally {
      setSubmitting(false);
    }
  }

  function togglePermission(key: string) {
    setRoleForm((f) => ({
      ...f,
      permissionKeys: f.permissionKeys.includes(key) ? f.permissionKeys.filter((k) => k !== key) : [...f.permissionKeys, key],
    }));
  }

  const permissionsByModule = permissions.reduce<Record<string, PermissionCatalogItemDto[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-navy dark:text-paper">Users &amp; Roles</h1>

      <div className="flex gap-2 border-b border-navy-100 dark:border-navy-600">
        {(["users", "roles"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize ${tab === t ? "border-b-2 border-crimson font-medium text-navy dark:text-paper" : "text-navy-400 dark:text-navy-100"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="text-crimson">{error}</p>}

      {tab === "users" && (
        <>
          {can("users.create") && (
            <Card>
              <p className="mb-3 font-display text-lg text-navy dark:text-paper">Add user</p>
              <div className="flex flex-wrap items-end gap-3">
                <Input placeholder="Full name" value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} className="w-48" />
                <Input placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="w-56" />
                <Input placeholder="Temporary password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="w-48" />
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {(roles ?? []).map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm text-navy-400 dark:text-navy-100">
                    <input
                      type="checkbox"
                      checked={userForm.roleIds.includes(r.id)}
                      onChange={() =>
                        setUserForm((f) => ({
                          ...f,
                          roleIds: f.roleIds.includes(r.id) ? f.roleIds.filter((id) => id !== r.id) : [...f.roleIds, r.id],
                        }))
                      }
                    />
                    {r.name}
                  </label>
                ))}
              </div>
              <Button className="mt-3" disabled={submitting} onClick={createUser}>Create user</Button>
            </Card>
          )}

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy-100 text-navy-400 dark:border-navy-600 dark:text-navy-100">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                  {can("users.edit") && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {(users ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-navy-400 dark:text-navy-100">No users found.</td></tr>
                ) : (
                  users!.map((u) => (
                    <tr key={u.id} className="border-b border-navy-100 last:border-0 dark:border-navy-600">
                      <td className="px-4 py-3 font-medium text-navy dark:text-paper">{u.fullName}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3">{u.roles.join(", ")}</td>
                      <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                      <td className="px-4 py-3 text-navy-400 dark:text-navy-100">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                      </td>
                      {can("users.edit") && (
                        <td className="px-4 py-3">
                          <Select
                            value={u.status}
                            disabled={statusUpdating === u.id}
                            onChange={(e) => changeStatus(u.id, e.target.value as UserStatus)}
                            className="w-32 py-1 text-xs"
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="SUSPENDED">Suspended</option>
                            <option value="DISABLED">Disabled</option>
                          </Select>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {tab === "roles" && (
        <>
          {can("roles.manage") && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-lg text-navy dark:text-paper">{roleForm.id ? `Edit role: ${roleForm.name}` : "Create role"}</p>
                {roleForm.id && (
                  <button onClick={() => setRoleForm(BLANK_ROLE_FORM)} className="text-xs text-navy-400 underline hover:text-crimson dark:text-navy-100">
                    Cancel edit / create new instead
                  </button>
                )}
              </div>
              <div className="mb-3 flex flex-wrap gap-3">
                <Input placeholder="Role name" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} className="w-48" />
                <Input placeholder="Description (optional)" value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} className="w-64" />
              </div>
              <div className="flex flex-col gap-3">
                {Object.entries(permissionsByModule).map(([module, perms]) => (
                  <div key={module}>
                    <p className="mb-1 text-xs font-medium uppercase text-navy-400 dark:text-navy-100">{module.replace(/_/g, " ")}</p>
                    <div className="flex flex-wrap gap-3">
                      {perms.map((p) => (
                        <label key={p.key} className="flex items-center gap-1.5 text-sm text-navy-400 dark:text-navy-100">
                          <input type="checkbox" checked={roleForm.permissionKeys.includes(p.key)} onChange={() => togglePermission(p.key)} />
                          {p.action}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Button className="mt-4" disabled={submitting} onClick={saveRole}>
                {submitting ? "Saving…" : roleForm.id ? "Save changes" : "Create role"}
              </Button>
            </Card>
          )}

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy-100 text-navy-400 dark:border-navy-600 dark:text-navy-100">
                <tr>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Permissions</th>
                  <th className="px-4 py-3 font-medium">System</th>
                  {can("roles.manage") && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {(roles ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-navy-100 last:border-0 dark:border-navy-600">
                    <td className="px-4 py-3 font-medium text-navy dark:text-paper">{r.name}</td>
                    <td className="px-4 py-3">{r.description ?? "—"}</td>
                    <td className="px-4 py-3 text-navy-400 dark:text-navy-100">{r.permissions.length}</td>
                    <td className="px-4 py-3 text-navy-400 dark:text-navy-100">{r.isSystem ? "Yes" : "No"}</td>
                    {can("roles.manage") && (
                      <td className="px-4 py-3">
                        <button onClick={() => editRole(r)} className="text-xs text-navy underline hover:text-crimson dark:text-paper">
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
