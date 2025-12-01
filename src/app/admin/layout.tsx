"use client"

import { useAuth } from "../../context/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAdmin, user } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Wait for auth to be ready (user is set or explicitly null)
    if (user === undefined) {
      // Still loading, don't redirect yet
      return;
    }

    setIsChecking(false);

    // Only redirect if we're sure the user is not an admin
    if (!isAdmin) {
      router.push('/');
    }
  }, [isAdmin, user, router]);

  // Show loading state while checking auth
  if (isChecking || user === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold">Loading...</div>
          <div className="text-sm text-muted-foreground mt-2">Verifying authentication</div>
        </div>
      </div>
    );
  }

  // Only render children if user is admin
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ✅ FIX: Remove fixed positioning, add proper layout */}
      <div className="w-full">
        {children}
      </div>
    </div>
  )
}
