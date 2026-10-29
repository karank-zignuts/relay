// Generates the Supabase auth email templates in supabase/templates/ from one shared layout.
// Run: npm run emails:build   Then paste each file into Supabase → Authentication → Emails → Templates.
// Uses only email-safe HTML (tables, inline styles) and Supabase's Go template variables.
import { mkdirSync, writeFileSync } from "node:fs";

const INK = "#000000";
const GRAPHITE = "#44403b";
const SMOKE = "#777169";
const STONE = "#ebe8e4";
const TAUPE = "#f5f3f1";
const EGGSHELL = "#fdfcfc";
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Menlo,Consolas,monospace";

const greeting = `{{ if .Data.full_name }}Hi {{ .Data.full_name }},{{ else }}Hi,{{ end }}`;
const roleName = `{{ if eq .Data.role "super_admin" }}Super Admin{{ else if eq .Data.role "project_manager" }}Project Manager{{ else if eq .Data.role "developer" }}Developer{{ else if eq .Data.role "tester" }}Tester{{ end }}`;

const p = (html, extra = "") => `<p style="margin:0 0 16px;font:400 15px/1.65 ${FONT};color:${GRAPHITE};${extra}">${html}</p>`;

const button = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
  <tr><td align="center" bgcolor="${INK}" style="border-radius:999px;background:${INK};">
    <a href="${href}" target="_blank" style="display:inline-block;padding:15px 30px;font:500 15px/1 ${FONT};color:${EGGSHELL};text-decoration:none;border-radius:999px;mso-padding-alt:0;">${label}</a>
  </td></tr>
</table>`;

const fallback = (href) => `
<p style="margin:20px 0 0;font:400 12px/1.6 ${FONT};color:${SMOKE};">Button not working? Copy this link into your browser:</p>
<p style="margin:4px 0 0;font:400 12px/1.5 ${MONO};color:${GRAPHITE};word-break:break-all;"><a href="${href}" style="color:${GRAPHITE};text-decoration:underline;">${href}</a></p>`;

const panel = (rows) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;background:${TAUPE};border-radius:12px;">
  <tr><td style="padding:16px 18px;">${rows
    .map(([k, v]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:3px 0;font:400 13px/1.5 ${FONT};color:${SMOKE};width:96px;">${k}</td><td style="padding:3px 0;font:500 13px/1.5 ${FONT};color:${INK};">${v}</td></tr></table>`)
    .join("")}</td></tr>
</table>`;

function layout({ title, preheader, heading, body }) {
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${TAUPE};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${TAUPE}" style="background:${TAUPE};">
  <tr><td align="center" style="padding:40px 16px 48px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
      <tr><td style="padding:0 6px 20px;font:300 24px/1 ${FONT};letter-spacing:-0.02em;color:${INK};">Relay</td></tr>
      <tr><td bgcolor="${EGGSHELL}" style="background:${EGGSHELL};border:1px solid ${STONE};border-radius:20px;padding:40px 36px;">
        <h1 style="margin:0 0 20px;font:300 30px/1.15 ${FONT};letter-spacing:-0.02em;color:${INK};">${heading}</h1>
        ${body}
      </td></tr>
      <tr><td style="padding:20px 6px 0;font:400 12px/1.6 ${FONT};color:${SMOKE};">
        Sent by Relay to {{ .Email }}.<br>
        Relay turns your client's Slack channel into a task board your whole team can see.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;
}

const link = (type) => `{{ .SiteURL }}/set-password?token_hash={{ .TokenHash }}&amp;type=${type}`;

const templates = {
  invite: {
    subject: "You're invited to Relay",
    html: layout({
      title: "You're invited to Relay",
      preheader: "Accept your invitation and choose a password.",
      heading: "You're invited to Relay",
      body: `
        ${p(greeting)}
        ${p("You have been invited to join your team on <strong style=\"color:" + INK + ";\">Relay</strong>, where client requests from Slack are tracked, assigned and never forgotten.")}
        {{ if .Data.role }}${panel([["Your role", roleName], ["Account", "{{ .Email }}"]])}{{ end }}
        ${button(link("invite"), "Accept invitation")}
        ${p("You will choose a password, then sign in. The link works once, so open it yourself rather than forwarding it.", "margin-top:16px;")}
        ${fallback(link("invite"))}
        <hr style="border:0;border-top:1px solid ${STONE};margin:28px 0 16px;">
        ${p("Not expecting this? You can safely ignore this email. Nothing happens until the link is used.", `font-size:13px;color:${SMOKE};margin:0;`)}`,
    }),
  },
  recovery: {
    subject: "Reset your Relay password",
    html: layout({
      title: "Reset your Relay password",
      preheader: "Use this link to choose a new password.",
      heading: "Reset your password",
      body: `
        ${p(greeting)}
        ${p("We received a request to reset the password for your Relay account. Press the button to choose a new one.")}
        ${button(link("recovery"), "Choose a new password")}
        ${p("The link works once and expires soon. After saving, you will be sent to the sign-in page.", "margin-top:16px;")}
        ${fallback(link("recovery"))}
        <hr style="border:0;border-top:1px solid ${STONE};margin:28px 0 16px;">
        ${p("Did not ask for this? Ignore this email and your password stays the same. If it keeps happening, tell your admin.", `font-size:13px;color:${SMOKE};margin:0;`)}`,
    }),
  },
  confirmation: {
    subject: "Confirm your Relay email",
    html: layout({
      title: "Confirm your email",
      preheader: "Confirm your email address to finish setting up Relay.",
      heading: "Confirm your email",
      body: `
        ${p(greeting)}
        ${p("Confirm that <strong style=\"color:" + INK + ";\">{{ .Email }}</strong> is your email address to finish setting up your Relay account.")}
        ${button("{{ .ConfirmationURL }}", "Confirm email")}
        ${fallback("{{ .ConfirmationURL }}")}
        <hr style="border:0;border-top:1px solid ${STONE};margin:28px 0 16px;">
        ${p("If you did not create this account, you can ignore this email.", `font-size:13px;color:${SMOKE};margin:0;`)}`,
    }),
  },
  magic_link: {
    subject: "Your Relay sign-in link",
    html: layout({
      title: "Your sign-in link",
      preheader: "Use this one-time link to sign in to Relay.",
      heading: "Sign in to Relay",
      body: `
        ${p(greeting)}
        ${p("Use the button below to sign in. The link works once and expires soon.")}
        ${button("{{ .ConfirmationURL }}", "Sign in")}
        ${fallback("{{ .ConfirmationURL }}")}
        <hr style="border:0;border-top:1px solid ${STONE};margin:28px 0 16px;">
        ${p("Did not request this? You can ignore this email.", `font-size:13px;color:${SMOKE};margin:0;`)}`,
    }),
  },
  email_change: {
    subject: "Confirm your new Relay email",
    html: layout({
      title: "Confirm your new email",
      preheader: "Confirm the change of your Relay email address.",
      heading: "Confirm your new email",
      body: `
        ${p(greeting)}
        ${p("You asked to change your Relay email address. Confirm the change to continue.")}
        ${panel([["From", "{{ .Email }}"], ["To", "{{ .NewEmail }}"]])}
        ${button("{{ .ConfirmationURL }}", "Confirm change")}
        ${fallback("{{ .ConfirmationURL }}")}
        <hr style="border:0;border-top:1px solid ${STONE};margin:28px 0 16px;">
        ${p("Did not ask for this? Ignore this email and tell your admin, because someone may have access to your account.", `font-size:13px;color:${SMOKE};margin:0;`)}`,
    }),
  },
  reauthentication: {
    subject: "Your Relay confirmation code",
    html: layout({
      title: "Your confirmation code",
      preheader: "Enter this code to confirm it is you.",
      heading: "Confirm it is you",
      body: `
        ${p(greeting)}
        ${p("Enter this code in Relay to confirm the change you are making:")}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px;"><tr><td style="background:${TAUPE};border-radius:12px;padding:18px 28px;font:500 32px/1 ${MONO};letter-spacing:0.28em;color:${INK};">{{ .Token }}</td></tr></table>
        ${p("The code expires soon. Never share it with anyone.", "margin-top:16px;")}
        <hr style="border:0;border-top:1px solid ${STONE};margin:28px 0 16px;">
        ${p("Did not request this? Ignore this email.", `font-size:13px;color:${SMOKE};margin:0;`)}`,
    }),
  },
};

mkdirSync("supabase/templates", { recursive: true });
let readme = "# Auth email templates\n\nGenerated by `npm run emails:build` from `scripts/build-email-templates.mjs`. Edit the script, not the HTML.\n\nPaste each file into **Supabase → Authentication → Emails → Templates** and use the subject shown.\n\n| Template in Supabase | File | Subject |\n|---|---|---|\n";
const names = { invite: "Invite user", recovery: "Reset password", confirmation: "Confirm sign up", magic_link: "Magic link", email_change: "Change email address", reauthentication: "Reauthentication" };
for (const [key, { subject, html }] of Object.entries(templates)) {
  writeFileSync(`supabase/templates/${key}.html`, html);
  readme += `| ${names[key]} | \`${key}.html\` | ${subject} |\n`;
}
readme += "\nInvite and reset links go to `{{ .SiteURL }}/set-password?token_hash=…`, so **Site URL** in Authentication → URL Configuration must be your app's URL. Relay never uses sign-up confirmation or magic links (sign-up is off), but they are styled so every email matches.\n";
writeFileSync("supabase/templates/README.md", readme);
console.log(`Wrote ${Object.keys(templates).length} templates to supabase/templates/`);
