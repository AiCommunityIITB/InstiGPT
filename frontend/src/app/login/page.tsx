"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { LoadingIndicator, LogoWithText } from "@/components";
import { useMeQuery } from "@/lib";
import { LoginForm } from "./login-form";

export default function Login() {
  const router = useRouter();

  const { isLoading } = useMeQuery((data) => data.user && router.replace("/"));

  return (
    <>
      <LoadingIndicator loading={isLoading} />
      <div className="grid h-screen w-screen place-items-center px-10">
        <div className="flex flex-col items-center space-y-8 rounded-xl bg-background-alt p-10">
          <LogoWithText className="h-24" />
          <LoginForm />
          <span className="text-xs">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="underline underline-offset-2">
              Register
            </Link>
          </span>
        </div>
      </div>
    </>
  );
}
