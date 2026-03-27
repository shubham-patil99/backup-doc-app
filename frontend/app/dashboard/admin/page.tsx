import ProtectedRoute from "@/components/ProtectedRoute";
import AdminDashboardContent from "./AdminDashboardContent"; 


export default function AdminDashboard() {
  return (
    <ProtectedRoute allowedRoles={[1]}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}
