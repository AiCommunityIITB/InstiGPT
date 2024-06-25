"use client";

import { FC, useState } from "react";
import { useRouter } from "next/navigation";

import { ErrorDialog, LoadingIndicatorWithoutBackdrop } from "@/components";
import { useRegisterMutation } from "@/lib";

interface RegisterFormProps {}

export const RegisterForm: FC<RegisterFormProps> = () => {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");

  const router = useRouter();
  const { mutate, data, isLoading, isError, error } = useRegisterMutation();

  return (
    <>
      {isError && <ErrorDialog msg={(error as Error).message} />}
      {data?.detail && <ErrorDialog msg={data.detail} />}
      {formError && <ErrorDialog msg={formError} />}
      <form
        className="mt-4 flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (password !== confirmPassword) {
            setFormError("Passwords do not match");
            return;
          }

          mutate(
            { name, username, password },
            {
              onSuccess: () => router.refresh(),
            },
          );
        }}
      >
        <h1 className="mb-4 border-b-[1px] border-b-foreground text-center text-xl font-semibold">
          Register
        </h1>
        <div>
          <label
            className="mb-2 block text-sm font-bold text-slate-400"
            htmlFor="name"
          >
            Name
          </label>
          <input
            className="focus:shadow-outline w-full appearance-none rounded border border-slate-500 bg-background/80 px-3 py-2 leading-tight text-foreground shadow focus:outline-none"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-bold text-slate-400"
            htmlFor="username"
          >
            Username
          </label>
          <input
            className="focus:shadow-outline w-full appearance-none rounded border border-slate-500 bg-background/80 px-3 py-2 leading-tight text-foreground shadow focus:outline-none"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-bold text-slate-400"
            htmlFor="password"
          >
            Password
          </label>
          <input
            className="focus:shadow-outline w-full appearance-none rounded border border-slate-500 bg-background/80 px-3 py-2 leading-tight text-foreground shadow focus:outline-none"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-bold text-slate-400"
            htmlFor="confirmPassword"
          >
            Confirm Password
          </label>
          <input
            className="focus:shadow-outline w-full appearance-none rounded border border-slate-500 bg-background/80 px-3 py-2 leading-tight text-foreground shadow focus:outline-none"
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-primary-gradient px-4 py-2 font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          disabled={isLoading}
        >
          Register <LoadingIndicatorWithoutBackdrop loading={isLoading} />
        </button>
      </form>
    </>
  );
};
