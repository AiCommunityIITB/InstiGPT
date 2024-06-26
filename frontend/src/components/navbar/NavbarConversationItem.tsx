import { FC, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import {
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon,
} from "@heroicons/react/24/solid";

import { Conversation } from "@/lib/types";
import {
  useDeleteConversationMutation,
  useEditConversationMutation,
} from "@/lib";
import { ErrorDialog, LoadingIndicator } from "@/components";
import { EnterTitleModal } from "./EnterTitleModal";

interface NavbarConversationItemProps {
  conversation: Conversation;
  closeNavbar: () => void;
}

export const NavbarConversationItem: FC<NavbarConversationItemProps> = ({
  conversation,
  closeNavbar,
}) => {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { id: conversationId } = useParams();

  const deleteConversation = useDeleteConversationMutation();
  const editConversation = useEditConversationMutation();

  return (
    <>
      <LoadingIndicator
        loading={deleteConversation.isLoading || editConversation.isLoading}
      />
      <ErrorDialog
        msg={
          deleteConversation.error?.message ??
          editConversation.error?.message ??
          deleteConversation.data?.detail ??
          editConversation.data?.detail
        }
      />
      <Link
        onMouseLeave={() => setConfirmDelete(false)}
        href={`/conversation/${conversation._id}`}
        className={`group flex h-10 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-300 hover:bg-gray-700 ${
          conversation._id === (conversationId as string) ? "bg-primary/50" : ""
        }`}
        onClick={() => closeNavbar()}
      >
        <div className="flex-1 truncate">
          {confirmDelete && <span className="font-semibold"> Delete </span>}
          {conversation.title}
        </div>

        {confirmDelete ? (
          <>
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded md:hidden md:group-hover:flex"
              title="Confirm delete action"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteConversation.mutate(conversation._id, {
                  onSuccess: () => {
                    setConfirmDelete(false);
                    if (conversation._id === conversationId) {
                      router.push("/");
                    }
                  },
                });
              }}
            >
              <CheckIcon className="h-full w-full text-gray-400 hover:text-gray-300" />
            </button>
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded md:hidden md:group-hover:flex"
              title="Cancel delete action"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmDelete(false);
              }}
            >
              <XMarkIcon className="h-full w-full text-gray-400 hover:text-gray-300" />
            </button>
          </>
        ) : (
          <>
            <EnterTitleModal
              isOpen={isModalOpen}
              closeModal={() => setIsModalOpen(false)}
              isLoading={editConversation.isLoading}
              title="Edit Conversation"
              description={`You are editing the conversation with the title: ${conversation.title}`}
              onSubmit={(newTitle) => {
                if (newTitle !== null && newTitle !== "") {
                  editConversation.mutate({ id: conversation._id, newTitle });
                }
                setIsModalOpen(false);
              }}
            />
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded md:hidden md:group-hover:flex"
              title="Edit conversation title"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                setIsModalOpen(true);
              }}
            >
              <PencilIcon className="h-full w-full text-gray-400 hover:text-gray-300" />
            </button>

            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded md:hidden md:group-hover:flex"
              title="Delete conversation"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmDelete(true);
              }}
            >
              <TrashIcon className="h-full w-full text-gray-400  hover:text-gray-300" />
            </button>
          </>
        )}
      </Link>
    </>
  );
};
