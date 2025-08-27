"use client";

import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";

export default function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading user...</div>;
  }

  if (!user) {
    return (
      <div>
        <h1>Login Required</h1>
        <p>You must be logged in to view this page.</p>
        <Link href="/login">Go to Login</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold">Profile Page Works</h1>
      <p className="mt-4">If you can see this, the page is rendering correctly.</p>
      <p>Your User ID is: {user.uid}</p>
      <p>Your Email is: {user.email}</p>
    </div>
  );
}