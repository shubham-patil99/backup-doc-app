// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { Box, Button, Image, Text } from "grommet";
import { Logout } from "grommet-icons";

// Existing tabs
import SectionsTab from "./sections/SectionsTab";
import ModulesTab from "./modules/ModulesTab";
import UsersTab from "./users/UsersTab";
import PermissionsTab from "./permissions/PermissionsTab";
import SettingsPage from "./settings/page";

// 👇 New Engagement Tab
import CustomerTab from "./engagement/CustomerTab";
import OpeTab from "./allOpes/OpeTab";

const tabItems = [
  { label: "Modules", component: SectionsTab },
  { label: "Sections", component: ModulesTab },
  { label: "Users", component: UsersTab },
  { label: "Customer Db", component: CustomerTab }, // ✅ added
  { label: "All OPEs", component: OpeTab }, 
  { label: "Settings", component: SettingsPage },
];

export default function AdminDashboardContent() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [initials, setInitials] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Extract user initials from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user?.name) {
        const names = user.name.split(" ");
        const generatedInitials =
          names.length === 1
            ? names[0][0].toUpperCase()
            : (names[0][0] + names[names.length - 1][0]).toUpperCase();
        setInitials(generatedInitials);
      }
    }
  }, []);

  // Fetch logo from backend
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        // Use relative API path - Next.js will proxy to backend
        const response = await fetch("/api/settings/logo/file", {
          credentials: "include",
        });
        if (response.ok) {
          const blob = await response.blob();
          const logoBlob = URL.createObjectURL(blob);
          setLogoUrl(logoBlob);
        } else {
          console.error(`Failed to fetch logo: ${response.status}`);
        }
      } catch (err) {
        console.error("Failed to fetch logo:", err);
      }
    };

    fetchLogo();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  const ActiveTabComponent = tabItems[activeIndex].component;

  return (
    <Box>
      {/* Fixed Header */}
      <Box
        direction="row"
        align="center"
        justify="between"
        pad={{ vertical: "small", horizontal: "medium" }}
        background="rgb(29, 31, 39)"
        elevation="medium"
        style={{ position: "fixed", top: 0, width: "100%", zIndex: 999 }}
      >
        {/* Left Logo */}
         <div className="flex items-center gap-2">
            {logoUrl && <Image src={logoUrl} alt="HPE Logo" width="80px" height="80px" />}
            <Text size="small" color="#fff" className="text-center sm:text-left text-sm font-bold sm:text-base">
              Brahma
            </Text>
          </div>

        {/* Tabs + Profile */}
        <Box direction="row" align="center" gap="small">
          {/* Tabs */}
          {tabItems.map((tab, index) => (
            <Button
              key={tab.label}
              label={tab.label}
              onClick={() => setActiveIndex(index)}
              plain
              style={{
                padding: "8px 12px",
                color: activeIndex === index ? "#fff" : "#d1d1d1",
                fontWeight: activeIndex === index ? "bold" : "normal",
              }}
            />
          ))}

          {/* Profile Button */}
          <Button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            plain
          >
            <Box
              width="32px"
              height="32px"
              round="full"
              align="center"
              justify="center"
              background="#6200EE"
            >
              <Text color="white" weight="bold">
                {initials || "?"}
              </Text>
            </Box>
          </Button>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <Box
              background="white"
              pad="small"
              round="small"
              elevation="small"
              style={{
                position: "absolute",
                top: "50px",
                right: "20px",
                minWidth: "160px",
                border: "1px solid #e5e7eb",
              }}
            >
              <Button
                plain
                icon={<Logout />}
                label="Logout"
                onClick={handleLogout}
                color="status-critical"
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  padding: "8px",
                }}
              />
              <Box
                style={{
                  borderTop: "1px solid #f3f4f6",
                  marginTop: "2px",
                }}
              >
                <Text size="12px" color="#1f2937" weight="bold">
                  brahma_2026.04_IT4
                </Text>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Dynamic Content Area */}
      <Box pad={{ top: "80px", horizontal: "medium", bottom: "medium" }}>
        <ActiveTabComponent />
      </Box>
    </Box>
  );
}
