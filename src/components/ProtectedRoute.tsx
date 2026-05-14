import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { AppRole } from "@/types";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
  roles?: AppRole[];
}

const ProtectedRoute = ({ children, roles }: Props) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (roles && roles.length > 0 && !roles.some((r) => user.roles.includes(r))) {
    if (user.roles.includes("admin") || user.roles.includes("municipal_officer")) {
      return <Navigate to="/municipal" replace />;
    } else if (user.roles.includes("city_planner")) {
      return <Navigate to="/analytics" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
