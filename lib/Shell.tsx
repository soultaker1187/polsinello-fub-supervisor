import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="top">
        <div className="in">
          <a className="brand" href="/">polsinello<span>.</span> Database Supervisor</a>
          <nav>
            <a href="/">Overview</a>
            <a href="/needs-a-call">Needs A Call</a>
            <a href="/new-leads">New leads</a>
            <a href="/hygiene">Clean-up</a>
            <a href="/settings">Settings</a>
          </nav>
          <form method="post" action="/api/logout"><button type="submit">Sign out</button></form>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
