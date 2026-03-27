// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { Box, Button, Select, Text } from "grommet";
import { Trash2, ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export default function EngagementResourceRow({ idx, resource, updateResource, removeResource }) {
  const [roles, setRoles] = useState<string[]>([]);
  const [names, setNames] = useState<Array<{ id: number; memberName: string }>>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all roles on component mount
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const data = await apiFetch("/engagement/roles");
        if (data.success) {
          setRoles(data.roles);
        }
      } catch (error) {
        console.error("Error fetching roles:", error);
      }
    };
    fetchRoles();
  }, []);

  // Fetch names when role is selected
  useEffect(() => {
    const fetchNames = async () => {
      if (!resource.role) {
        setNames([]);
        return;
      }

      setLoading(true);
      try {
        const data = await apiFetch(`/engagement/names?role=${encodeURIComponent(resource.role)}`);
        if (data.success) {
          setNames(data.members);
        }
      } catch (error) {
        console.error("Error fetching names:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchNames();
  }, [resource.role]);

  return (
    <Box direction="row" gap="medium" align="center">
      {/* Role Select */}
      <Box width="medium">
        <Select
          placeholder="Select Role..."
          value={resource.role}
          options={roles}
          onChange={({ value }) => {
            updateResource(idx, { ...resource, role: value, name: "" });
          }}
          icon={<ChevronDown size={16} />}
          dropProps={{
            elevation: "medium",
            round: "small",
            margin: { top: "xsmall" }
          }}
        />
      </Box>

      {/* Name Select - Only enabled if role is selected */}
      <Box width="medium">
        <Select
          placeholder={resource.role ? "Select Name..." : "Select role first..."}
          value={resource.name}
          options={names.map(n => n.memberName)}
          onChange={({ value }) => {
            updateResource(idx, { ...resource, name: value });
          }}
          disabled={!resource.role || loading}
          icon={<ChevronDown size={16} />}
          dropProps={{
            elevation: "medium",
            round: "small",
            margin: { top: "xsmall" }
          }}
        />
      </Box>

      <Button
        icon={<Trash2 size={18} />}
        onClick={() => removeResource(idx)}
        tip="Remove"
        plain
        hoverIndicator="light-2"
        style={{
          padding: "8px",
          borderRadius: "4px",
        }}
      />
    </Box>
  );
}