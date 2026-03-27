"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: number[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/auth/login");
      } else if (allowedRoles && !allowedRoles.includes(Number(user.role))) {
        if (Number(user.role) === 1) router.replace("/dashboard/admin");
        else if (Number(user.role) === 2) router.replace("/dashboard/user");
        else router.replace("/");
      }
    }
  }, [user, loading, router, allowedRoles]);

  if (loading || !user) return null; // wait until user is loaded

  return <>{children}</>;
}
