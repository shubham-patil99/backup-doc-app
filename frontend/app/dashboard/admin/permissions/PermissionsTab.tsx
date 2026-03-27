"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardHeader,
  CardBody,
  Select,
  Text,
  CheckBox,
} from "grommet";
import { Trash, Checkbox } from "grommet-icons";
import { apiFetch } from "@/lib/apiClient";

export default function PermissionsTab() {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | "all" | null>(null);
  const [selectedModule, setSelectedModule] = useState<number | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  // ✅ Fetch users, modules, and permissions
  const fetchData = async () => {
    try {
      const [userData, moduleData, permData] = await Promise.all([
        apiFetch("/users"),
        apiFetch("/modules"),
        apiFetch("/user-module-permissions"),
      ]);

      setUsers(userData);
      setModules(moduleData);
      setPermissions(permData);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ✅ Assign permission
  const handleAssign = async () => {
    if (!selectedModule || !users.length) return;

    const targetUsers =
      selectedUser === "all"
        ? users
        : users.filter((u) => u.id === selectedUser);

    const alreadyAssigned = targetUsers.some((u) =>
      permissions.some(
        (p) => p.user_id === u.id && p.module_id === selectedModule
      )
    );

    if (alreadyAssigned) {
      alert("This section is already assigned to the selected user(s)");
      return;
    }

    try {
      const promises = targetUsers.map((u) =>
        apiFetch("/user-module-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: u.id,
            module_id: selectedModule,
            can_edit: canEdit,
          }),
        })
      );

      const results = await Promise.all(promises);

      // Map returned permissions to include full user & module
      const newPermissions = results.map((perm) => {
        const user = users.find((u) => u.id === perm.user_id);
        const module = modules.find((m) => m.id === perm.module_id);
        return { ...perm, user, module };
      });

      setPermissions((prev) => [...prev, ...newPermissions]);

      // Reset form
      setSelectedUser(null);
      setSelectedModule(null);
      setCanEdit(false);
    } catch (err) {
      console.error("Failed to assign permission:", err);
    }
  };

  // ✅ Delete permission
  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/user-module-permissions/${id}`, {
        method: "DELETE",
      });
      setPermissions((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete permission:", err);
    }
  };

  return (
    <Box pad="medium" gap="medium" direction="row-responsive" wrap>
      {/* Assign Permission Form */}
      <Box
        pad="medium"
        background="light-1"
        round="small"
        elevation="small"
        width="medium"
        margin={{ bottom: "medium" }}
      >
        <Text size="large" weight="bold" margin={{ bottom: "small" }}>
          Assign Section Permission
        </Text>

        <Box gap="small">
          {/* Select User */}
          <Select
            options={[
              { label: "All Users", value: "all" },
              ...users.map((u) => ({ label: u.name, value: u.id })),
            ]}
            value={
              selectedUser !== null
                ? {
                    label:
                      selectedUser === "all"
                        ? "All Users"
                        : users.find((u) => u.id === selectedUser)?.name || "",
                    value: selectedUser,
                  }
                : undefined
            }
            valueKey="value"
            labelKey="label"
            placeholder="Select User"
            onChange={({ option }) => setSelectedUser(option.value)}
          />

          {/* Select Module */}
          <Select
            options={modules.map((m) => ({ label: m.name, value: m.id }))}
            value={
              selectedModule !== null
                ? {
                    label:
                      modules.find((m) => m.id === selectedModule)?.name || "",
                    value: selectedModule,
                  }
                : undefined
            }
            valueKey="value"
            labelKey="label"
            placeholder="Select Section"
            onChange={({ option }) => setSelectedModule(option.value)}
          />

          <Box direction="row" align="center" gap="small">
            <CheckBox
              label="Can Edit"
              checked={canEdit}
              onChange={(e) => setCanEdit(e.target.checked)}
            />
            <Button primary label="Assign" onClick={handleAssign} size="large" />
          </Box>
        </Box>
      </Box>

      {/* Existing Permissions List */}
      <Card flex="grow" margin={{ bottom: "medium" }}>
        <CardHeader pad="small">
          <Text weight="bold">Existing Permissions</Text>
        </CardHeader>
        <CardBody pad="small">
          {permissions.length === 0 ? (
            <Text>No permissions assigned yet.</Text>
          ) : (
            <Box gap="small">
              {permissions.map((p, idx) => (
                <Box
                  key={p.id || `${p.user_id}-${p.module_id}-${idx}`}
                  direction="row"
                  justify="between"
                  align="center"
                  pad="small"
                  border={{ color: "border", size: "xsmall" }}
                  round="xsmall"
                >
                  <Text>
                    User {p.user?.name} — Section {p.module?.name} — Can Edit:{" "}
                    {p.can_edit ? "Yes" : "No"}
                  </Text>
                  <Button
                    icon={<Trash />}
                    color="status-critical"
                    onClick={() => handleDelete(p.id)}
                  />
                </Box>
              ))}
            </Box>
          )}
        </CardBody>
      </Card>
    </Box>
  );
}
