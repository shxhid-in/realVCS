"use client"

import { useAuth } from "../../context/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
    }
  }, [isAdmin, router]);

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
