"use client";

import { FC } from "react";
import { useRouter } from "next/navigation";

import { PlusIcon } from "@heroicons/react/24/solid";

import { useNewConversationMutation, constants } from "@/lib";
import { ErrorDialog, LoadingIndicator } from "@/components";

interface NewChatButtonProps {
  close?: () => void;
}

export const NewChatButton: FC<NewChatButtonProps> = ({ close }) => {
  const router = useRouter();
  const { mutate, data, isLoading, error } = useNewConversationMutation();

  return (
    <>
      <LoadingIndicator loading={isLoading} />
      <ErrorDialog msg={error?.message ?? data?.detail} />
      <button
        className="m-2 flex w-full max-w-full items-center justify-center rounded-lg border bg-primary-gradient px-2 py-1 font-bold uppercase text-foreground shadow-sm hover:shadow-none"
        onClick={() =>
          mutate(constants.NEW_CHAT_TITLE, {
            onSuccess: (data) => {
              if (data?.conversation === undefined) return;

              close?.();
              router.push(`/conversation/${data?.conversation._id}`);
            },
          })
        }
      >
        New Chat <PlusIcon className="ml-1 h-5 w-5" />
      </button>
    </>
  );
};
