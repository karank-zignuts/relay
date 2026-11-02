/** The Slack team id (T…), needed to open a message in the desktop app. It is not secret. Without it links open on the web as before. */
const TEAM = process.env.NEXT_PUBLIC_SLACK_TEAM_ID;

/** Turns a Slack permalink into a `slack://` deep link, or null when it cannot be built. */
export function slackAppUrl(permalink: string): string | null {
  if (!TEAM) return null;
  try {
    const url = new URL(permalink);
    const match = /^\/archives\/([A-Z0-9]+)(?:\/p(\d{7,}))?/.exec(url.pathname);
    if (!match) return null;
    const params = new URLSearchParams({ team: TEAM, id: match[1] });
    if (match[2]) params.set("message", `${match[2].slice(0, -6)}.${match[2].slice(-6)}`);
    const thread = url.searchParams.get("thread_ts");
    if (thread) params.set("thread_ts", thread);
    return `slack://channel?${params}`;
  } catch {
    return null;
  }
}

/**
 * Opens a Slack link in the desktop app without a browser tab. If the app does not take over (the page stays visible and focused),
 * falls back to the normal web link in a new tab. Modified clicks (new tab, new window) keep their normal behavior.
 */
export function openInSlack(event: React.MouseEvent<HTMLAnchorElement>, permalink: string) {
  const app = slackAppUrl(permalink);
  if (!app || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  let handled = false;
  const mark = () => {
    if (document.visibilityState === "hidden") handled = true;
  };
  document.addEventListener("visibilitychange", mark);
  window.addEventListener("blur", () => (handled = true), { once: true });
  window.location.href = app;
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", mark);
    if (!handled) window.open(permalink, "_blank", "noopener,noreferrer");
  }, 1500);
}
