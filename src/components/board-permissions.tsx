"use client";

import { createContext, useContext } from "react";

const BoardPermissionsContext = createContext({ canEdit: false });

export function BoardPermissionsProvider({
  canEdit,
  children,
}: {
  canEdit: boolean;
  children: React.ReactNode;
}) {
  return (
    <BoardPermissionsContext.Provider value={{ canEdit }}>
      {children}
    </BoardPermissionsContext.Provider>
  );
}

export function useBoardPermissions() {
  return useContext(BoardPermissionsContext);
}
