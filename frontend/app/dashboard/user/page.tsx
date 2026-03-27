// @ts-nocheck
"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Text, TextInput, Button, Spinner, Layer, Image } from "grommet";
import { FilePlus2, Search, X } from "lucide-react";
import CreateDocumentForm from "./create-document/CreateDocument/components/CreateDocumentForm";
import { useRouter } from "next/navigation";
import UserHeader from "@/components/UserHeader";
import { apiFetch } from "@/lib/apiClient";
import hpeLogo from "../../../assets/hpe-logo.png";

export default function UserDashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState("User");
  const debounceTimer = useRef<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("user");
      if (savedUser) setUserId(JSON.parse(savedUser).id);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setUsername(user?.name || user?.email || "User");
    }
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchText(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (value.trim()) fetchOpeResults(value.trim());
      else setSearchResults([]);
    }, 500);
  };

  const fetchOpeResults = async (opeId: string) => {
    setLoading(true);
    try {
      const json = await apiFetch(
        `/user-dashboard?search=${encodeURIComponent(opeId)}&page=1&limit=10`
      );
      setSearchResults(json.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box fill background="light-1">
      <UserHeader username={username} />

      {/* Split screen layout */}
      <Box
        direction="row"
        fill
        style={{
          minHeight: "100vh",
          // #00b386
          // #004f2d
          background:
            "linear-gradient(135deg, #004f2d 0%, #00b386 70%, #e8fff7 100%)",
        }}
      >
        {/* Left section */}
        <Box
          flex
          pad="large"
          justify="center"
          align="center"
          background="transparent"
        >
          <Box width="medium" animation={{ type: "fadeIn", duration: 800 }}>
            <Image src={hpeLogo.src} width="140px" margin={{ bottom: "medium" }} />
            <Text size="xxlarge" weight="bold" color="white" margin={{ bottom: "small" }}>
              Welcome, {username.split(" ")[0]} 👋
            </Text>
            <Text size="medium" color="white" style={{ opacity: 0.9 }}>
              Manage, create, and collaborate on your OPE documents effortlessly.
            </Text>
          </Box>
        </Box>

        {/* Right section - Action Card */}
        <Box
          flex
          align="center"
          justify="center"
          pad="large"
          animation={{ type: "fadeIn", duration: 800, delay: 200 }}
        >
          <Box
            background="white"
            pad="large"
            round="xxlarge"
            width="1200px"
            elevation="large"
            align="center"
            gap="medium"
            style={{
              boxShadow:
                "0 12px 40px rgba(0, 79, 45, 0.2), 0 0 0 4px rgba(0, 179, 134, 0.05)",
              transition: "transform 0.3s ease",
            }}
          >
            <Text size="xlarge" weight="bold" color="#004f2d">
              HPE Document Workspace
            </Text>
            <Text size="small" color="dark-5" textAlign="center">
              Choose an action below to get started
            </Text>

            <Button
              primary
              icon={<FilePlus2 size={18} />}
              label="Create New OPE"
              size="large"
              onClick={() => setShowCreateModal(true)}
              style={{
                width: "100%",
                background: "#00b386",
                borderRadius: "14px",
                fontWeight: "bold",
                boxShadow: "0 3px 12px rgba(0,179,134,0.3)",
              }}
            />
            <Button
              secondary
              icon={<Search size={18} />}
              label="Work on Existing OPE"
              size="large"
              onClick={() => setShowSearch(true)}
              style={{
                width: "100%",
                borderRadius: "14px",
                border: "2px solid #00b386",
                color: "#004f2d",
                fontWeight: "bold",
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Search Modal */}
      {showSearch && (
        <Layer
          onEsc={() => setShowSearch(false)}
          onClickOutside={() => setShowSearch(false)}
          responsive={false}
        >
          <Box
            pad="large"
            gap="medium"
            width="medium"
            background="white"
            round="xlarge"
            elevation="xlarge"
            animation={{ type: "fadeIn", duration: 300 }}
            style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.2)" }}
          >
            <Box
              direction="row"
              justify="between"
              align="center"
              margin={{ bottom: "small" }}
            >
              <Text weight="bold" size="large" color="#004f2d">
                Search OPE ID
              </Text>
              <Button
                icon={<X size={18} />}
                onClick={() => setShowSearch(false)}
                plain
              />
            </Box>

            <TextInput
              placeholder="Enter OPE ID..."
              value={searchText}
              onChange={handleSearchChange}
              style={{
                borderRadius: 10,
                borderColor: "#00b386",
                boxShadow: "0 0 0 1px #00b386 inset",
              }}
              autoFocus
            />

            {loading ? (
              <Box align="center" pad="small">
                <Spinner />
              </Box>
            ) : (
              <Box gap="small" width="100%">
                {searchText && searchResults.length === 0 && (
                  <Text color="status-critical" size="small">
                    No OPE IDs found
                  </Text>
                )}
                {searchResults.map((item) => (
                  <Box
                    key={item.opeId}
                    direction="row"
                    justify="between"
                    align="center"
                    pad="small"
                    background="light-2"
                    round="small"
                    margin={{ bottom: "xsmall" }}
                    hoverIndicator={{ background: "light-3" }}
                    style={{
                      borderLeft: "4px solid #00b386",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <Box>
                      <Text weight="bold" color="#004f2d">
                        {item.opeId}
                      </Text>
                      <Text size="small" color="text-weak">
                        Status: {item.status}
                      </Text>
                    </Box>
                    <Button
                      label="Open"
                      size="small"
                      primary
                      style={{
                        background: "#00b386",
                        borderRadius: 8,
                        fontWeight: 600,
                      }}
                      onClick={() => {
                        localStorage.setItem("currentOpeId", item.opeId);
                        localStorage.removeItem("customerInfo");
                        router.push("/dashboard/user/create-document");
                      }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Layer>
      )}

      {/* Create OPE Modal */}
      {showCreateModal && (
        <Layer
          onEsc={() => setShowCreateModal(false)}
          onClickOutside={() => setShowCreateModal(false)}
        >
          <CreateDocumentForm
            userId={userId}
            onClose={() => setShowCreateModal(false)}
          />
        </Layer>
      )}
    </Box>
  );
}
