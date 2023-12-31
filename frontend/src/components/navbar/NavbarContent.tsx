import { FC, useMemo } from "react";

import { useConversationsQuery, useMeQuery } from "@/lib";
import { Conversation } from "@/lib/types";

import { LogoWithText } from "../Logo";
import { NavbarConversationItem } from "./NavbarConversationItem";
import { NewChatButton } from "./NewChatButton";
import { ErrorDialog, LoadingIndicator } from "..";

const dateRanges = [
  new Date().setDate(new Date().getDate() - 1),
  new Date().setDate(new Date().getDate() - 7),
  new Date().setMonth(new Date().getMonth() - 1),
];
const groupConversations = (conversations: Conversation[]) => ({
  today: conversations.filter(
    ({ created_at }) => new Date(created_at).getTime() > dateRanges[0],
  ),
  week: conversations.filter(({ created_at }) => {
    const date = new Date(created_at).getTime();
    return date > dateRanges[1] && date < dateRanges[0];
  }),
  month: conversations.filter(({ created_at }) => {
    const date = new Date(created_at).getTime();
    return date > dateRanges[2] && date < dateRanges[1];
  }),
  older: conversations.filter(
    ({ created_at }) => new Date(created_at).getTime() < dateRanges[2],
  ),
});
const titles: { [key: string]: string } = {
  today: "Today",
  week: "This week",
  month: "This month",
  older: "Older",
} as const;

export const NavbarContent: FC = () => {
  // NOTE: We don't need to handle the loading and error states here as they are
  // already handled by the layout
  const { data: meData } = useMeQuery();

  const { data, isLoading, isError, error } = useConversationsQuery();
  const groupedConversations = useMemo(
    () => groupConversations(data?.conversations || []),
    [data],
  );

  return (
    <>
      <LoadingIndicator loading={isLoading} />
      {isError && <ErrorDialog msg={(error as Error).message} />}
      {meData?.detail && <ErrorDialog msg={JSON.stringify(meData.detail)} />}
      <div className="sticky top-0 flex flex-none items-center justify-between px-3 py-3.5 max-sm:pt-0">
        <LogoWithText size={100} />
      </div>
      <NewChatButton />
      <div className="scrollbar-custom flex flex-col gap-1 overflow-y-auto rounded-r-xl bg-background-alt px-3 pb-3 pt-2">
        {Object.entries(groupedConversations)
          .filter(([_, convs]) => convs.length > 0)
          .map(([group, convs], i) => (
            <div key={i}>
              <h4 className="mb-1.5 mt-4 pl-0.5 text-sm text-gray-500 first:mt-0">
                {titles[group]}
              </h4>
              {convs.map((conversation) => (
                <NavbarConversationItem
                  key={conversation.id}
                  conversation={conversation}
                />
              ))}
            </div>
          ))}
      </div>
      <div className="mt-0.5 flex flex-col gap-1 rounded-r-xl bg-background-alt p-3 text-sm md:bg-gradient-to-l">
        <span className="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-400 hover:bg-gray-700">
          {meData?.user?.name || "Loading..."}
        </span>
        <a
          href="/logout"
          className="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-400 hover:bg-gray-700"
          onClick={(e) => {
            e.preventDefault();
            // TODO: Logout here
          }}
        >
          Sign Out
        </a>
        <a
          href="#"
          target="_blank"
          rel="noreferrer"
          className="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-400 hover:bg-gray-700"
        >
          Feedback
        </a>
      </div>
    </>
  );
};
