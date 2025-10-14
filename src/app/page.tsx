"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoginPage from "../components/auth/LoginPage";

export default function Home() {
  const { butcher } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (butcher) {
      router.push("/dashboard");
    }
  }, [butcher, router]);

  if (butcher) {
    return null; // or a loading spinner
  }

  return <LoginPage />;
}
