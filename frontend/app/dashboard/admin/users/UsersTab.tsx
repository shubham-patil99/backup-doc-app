import { useEffect, useState } from "react";
import { UserPlus, Trash2, RefreshCw, Shield, User, Mail, Lock, Crown } from "lucide-react";
import { apiFetch } from "@/lib/apiClient"; // ✅ Use your real apiFetch here

type User = {
  id: number;
  name: string;
  email: string;
  role_id: number;
};

export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(2);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async () => {
    if (!name || !email || !password) {
      alert("Please fill all fields");
      return;
    }

    try {
      setLoading(true);
      const newUser = await apiFetch("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role_id: roleId }),
      });

      setUsers((prev) => [...prev, newUser]);
      setName("");
      setEmail("");
      setPassword("");
      setRoleId(2);
    } catch (err: any) {
      alert("Error: " + (err.message || "Failed to create user"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/users/${id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setDeleteConfirm(null);
    } catch (err: any) {
      alert("Error: " + (err.message || "Failed to delete user"));
    }
  };

  const handleToggleRole = async (user: User) => {
    const newRoleId = user.role_id === 1 ? 2 : 1;
    try {
      setLoading(true);
      await apiFetch(`/users/${user.id}`, {
        method: "PUT", // or PATCH depending on your backend
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_id: newRoleId }),
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role_id: newRoleId } : u))
      );
    } catch (err: any) {
      alert("Error updating role: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

 return (
  <div className="p-6 max-w-7xl mx-auto">

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Create User Form */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 sticky top-6">
          {/* Small Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-semibold text-gray-900">Create New User</h3>
            </div>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Enter Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="email"
                  placeholder="Enter Email Id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Role</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRoleId(2)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                    roleId === 2
                      ? "bg-green-50 border-green-500 text-green-700"
                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <User size={14} /> User
                </button>
                <button
                  type="button"
                  onClick={() => setRoleId(1)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                    roleId === 1
                      ? "bg-green-50 border-green-500 text-green-700"
                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Crown size={14} /> Admin
                </button>
              </div>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={loading || !name || !email || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #004f2d 0%, #00b386 70%, #e8fff7 100%)" }}
            >
              <UserPlus size={16} />
              {loading ? "Creating..." : "Create User"}
            </button>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          {/* Header Bar */}
          <div
  className="px-6 py-3 flex items-center justify-between rounded-t-2xl"
  style={{ background: "linear-gradient(135deg, #004f2d 0%, #00b386 70%)" }}
>
  <div className="flex items-center gap-2">
    <Shield className="h-4 w-4 text-white" />
    <h3 className="text-lg font-semibold text-white tracking-wide">All Users</h3>
  </div>
  <div className="flex items-center gap-3">
    <button
      onClick={fetchUsers}
      className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
      title="Refresh"
    >
      <RefreshCw size={14} className="text-white" />
    </button>
    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold shadow-md border border-white/30 text-sm">
      {users.length}
    </div>
  </div>
</div>


          {/* User List Body */}
          <div className="p-4">
            {loading && users.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No users yet. Create your first user.
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`group flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-sm ${
                      user.role_id === 1
                        ? "bg-green-50 border-green-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    {/* User Info */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          user.role_id === 1 ? "bg-green-100" : "bg-gray-200"
                        }`}
                      >
                        {user.role_id === 1 ? (
                          <Crown className="h-4 w-4 text-green-600" />
                        ) : (
                          <User className="h-4 w-4 text-gray-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>

                    {/* Actions (on hover) */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleToggleRole(user)}
                        className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          user.role_id === 1
                            ? "bg-green-600 focus:ring-green-500"
                            : "bg-gray-300 focus:ring-gray-400"
                        }`}
                        title={user.role_id === 1 ? "Demote to User" : "Promote to Admin"}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            user.role_id === 1 ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>

                      <button
                        onClick={() => setDeleteConfirm(user.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Delete Confirmation Modal */}
    {deleteConfirm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 size={24} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Delete User</h3>
              <p className="text-sm text-gray-600">This action cannot be undone</p>
            </div>
          </div>

          <p className="text-sm text-gray-700 mb-6">
            Are you sure you want to delete{" "}
            <span className="font-semibold">
              {users.find((u) => u.id === deleteConfirm)?.name}
            </span>
            ?
          </p>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDelete(deleteConfirm)}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete User
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);

}
