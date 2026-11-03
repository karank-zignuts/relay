// Generates the Supabase auth email templates in supabase/templates/ from one shared layout.
// Run: npm run emails:build   Then paste each file into Supabase → Authentication → Emails → Templates.
// Uses only email-safe HTML (tables, inline styles) and Supabase's Go template variables.
// Images (hero art, light logo, icons) come from scripts/build-email-assets.mjs and load from {{ .SiteURL }}/brand/email/.
import { mkdirSync, writeFileSync } from "node:fs";

const INK = "#000000";
const GRAPHITE = "#44403b";
const SMOKE = "#777169";
const STONE = "#ebe8e4";
const TAUPE = "#f5f3f1";
const EGGSHELL = "#fdfcfc";
const EMBER = "#ff4704";
const NIGHT = "#171615";
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Menlo,Consolas,monospace";
const IMG = "{{ .SiteURL }}/brand/email";

const greeting = `{{ if .Data.full_name }}Hi {{ .Data.full_name }},{{ else }}Hi,{{ end }}`;
const roleName = `{{ if eq .Data.role "super_admin" }}Super Admin{{ else if eq .Data.role "project_manager" }}Project Manager{{ else if eq .Data.role "developer" }}Developer{{ else if eq .Data.role "tester" }}Tester{{ end }}`;

const p = (html, extra = "") => `<p style="margin:0 0 16px;font:400 15px/1.65 ${FONT};color:${GRAPHITE};${extra}">${html}</p>`;

/** Full-width pill button. The arrow is plain text so it survives clients that block images. */
const button = (href, label) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 14px;">
  <tr><td align="center" bgcolor="${INK}" style="border-radius:999px;background:${INK};">
    <a href="${href}" target="_blank" style="display:block;padding:18px 24px;font:500 16px/1 ${FONT};color:${EGGSHELL};text-decoration:none;border-radius:999px;">${label}&nbsp;&nbsp;&rarr;</a>
  </td></tr>
</table>`;

const note = (html) => `<p style="margin:0 0 4px;text-align:center;font:400 13px/1.6 ${FONT};color:${SMOKE};">${html}</p>`;

const fallback = (href) => `
<p style="margin:22px 0 0;font:400 12px/1.6 ${FONT};color:${SMOKE};">Button not working? Copy this link into your browser:</p>
<p style="margin:4px 0 0;font:400 12px/1.5 ${MONO};color:${GRAPHITE};word-break:break-all;"><a href="${href}" style="color:${GRAPHITE};text-decoration:underline;">${href}</a></p>`;

const panel = (rows) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;background:${TAUPE};border-radius:14px;">
  <tr><td style="padding:16px 18px;">${rows
    .map(([k, v]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:3px 0;font:400 13px/1.5 ${FONT};color:${SMOKE};width:96px;">${k}</td><td style="padding:3px 0;font:500 13px/1.5 ${FONT};color:${INK};">${v}</td></tr></table>`)
    .join("")}</td></tr>
</table>`;

/** "Didn't request this?" with a small info icon. */
const safety = (title, text) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;border-top:1px solid ${STONE};">
  <tr>
    <td width="36" valign="top" style="padding:20px 12px 0 0;"><img src="${IMG}/ico-info.png" alt="" width="22" height="22" style="display:block;border:0;width:22px;height:22px;"></td>
    <td valign="top" style="padding:20px 0 0;font:400 13px/1.55 ${FONT};color:${SMOKE};"><strong style="font-weight:600;color:${INK};">${title}</strong><br>${text}</td>
  </tr>
</table>`;

const features = [
  ["ico-hash.png", "From Slack<br>to tasks"],
  ["ico-layers.png", "Assign<br>and track"],
  ["ico-bell.png", "Spot what needs attention"],
];
const featureCards = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
  <tr>${features
    .map(
      ([img, label], index) => `${index ? '<td width="8" style="font-size:0;line-height:0;">&nbsp;</td>' : ""}
    <td width="32%" valign="top" bgcolor="${TAUPE}" style="background:${TAUPE};border-radius:14px;padding:16px 12px;text-align:center;">
      <img src="${IMG}/${img}" alt="" width="26" height="26" style="display:block;margin:0 auto 10px;border:0;width:26px;height:26px;">
      <span style="font:500 13px/1.35 ${FONT};color:${INK};">${label}</span>
    </td>`,
    )
    .join("")}
  </tr>
</table>`;

function layout({ title, preheader, hero, heading, body }) {
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
  <tr><td align="center" style="padding:32px 12px 40px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="${EGGSHELL}" style="width:100%;max-width:560px;background:${EGGSHELL};border:1px solid ${STONE};border-radius:24px;overflow:hidden;">
      <tr><td bgcolor="${NIGHT}" style="background:${NIGHT};padding:30px 36px 6px;"><a href="{{ .SiteURL }}" style="text-decoration:none;"><img src="${IMG}/logo-light.png" alt="Relay" width="112" height="32" style="display:block;border:0;outline:none;width:112px;height:32px;font:600 22px/1 ${FONT};color:${EGGSHELL};"></a></td></tr>
      <tr><td bgcolor="${NIGHT}" style="background:${NIGHT};font-size:0;line-height:0;"><img src="${IMG}/hero-${hero}.png" alt="" width="560" style="display:block;border:0;width:100%;max-width:560px;height:auto;"></td></tr>
      <tr><td style="padding:6px 40px 40px;">
        <h1 style="margin:0 0 18px;font:600 30px/1.15 ${FONT};letter-spacing:-0.025em;color:${INK};">${heading}</h1>
        ${body}
      </td></tr>
    </table>
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
      <tr><td style="padding:22px 12px 0;text-align:center;font:400 12px/1.7 ${FONT};color:${SMOKE};">
        <img src="${IMG}/mark.png" alt="" width="22" height="22" style="display:inline-block;border:0;width:22px;height:22px;margin-bottom:8px;"><br>
        <strong style="font-weight:500;color:${GRAPHITE};">Every client message, tracked. Nothing forgotten.</strong><br>
        Sent by Relay to {{ .Email }}.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;
}

const link = (type) => `{{ .SiteURL }}/set-password?token_hash={{ .TokenHash }}&amp;type=${type}`;
const underlined = (word) => `<span style="border-bottom:3px solid ${EMBER};padding-bottom:1px;">${word}</span>`;

const templates = {
  invite: {
    subject: "You're invited to Relay",
    html: layout({
      title: "You're invited to Relay",
      preheader: "Accept your invitation and choose a password.",
      hero: "invite",
      heading: `Join your team on ${underlined("Relay")}`,
      body: `
        ${p(greeting)}
        ${p("You have been invited to collaborate on client requests in <strong style=\"color:" + INK + ";\">Relay</strong>, where every message from your client's Slack channel is tracked, assigned and followed up.")}
        {{ if .Data.role }}${panel([["Your role", roleName], ["Account", "{{ .Email }}"]])}{{ end }}
        ${featureCards}
        ${button(link("invite"), "Accept invitation")}
        ${note("You will choose a password, then sign in. The link works once and expires, so open it yourself.")}
        ${fallback(link("invite"))}
        ${safety("Not expecting this?", "You can safely ignore this email. Nothing happens until the link is used.")}`,
    }),
  },
  recovery: {
    subject: "Reset your Relay password",
    html: layout({
      title: "Reset your Relay password",
      preheader: "Use this link to choose a new password.",
      hero: "recovery",
      heading: "Reset your password",
      body: `
        ${p(greeting)}
        ${p("We received a request to reset the password for your Relay account. Use the button below to choose a new one.")}
        ${button(link("recovery"), "Reset password")}
        ${note("The link works once and expires soon. After saving, you will be sent to sign in.")}
        ${fallback(link("recovery"))}
        ${safety("Didn't request this?", "You can safely ignore this email and your password stays the same. If it keeps happening, tell your admin.")}`,
    }),
  },
  confirmation: {
    subject: "Confirm your Relay email",
    html: layout({
      title: "Confirm your email",
      preheader: "Confirm your email address to finish setting up Relay.",
      hero: "confirmation",
      heading: "Confirm your email address",
      body: `
        ${p(greeting)}
        ${p("You're almost in. Confirm that <strong style=\"color:" + INK + ";\">{{ .Email }}</strong> is your email address to finish setting up your Relay account.")}
        ${button("{{ .ConfirmationURL }}", "Confirm sign up")}
        ${note("The link works once and expires soon.")}
        ${fallback("{{ .ConfirmationURL }}")}
        ${safety("Didn't create an account?", "You can safely ignore this email.")}`,
    }),
  },
  magic_link: {
    subject: "Your Relay sign-in link",
    html: layout({
      title: "Your sign-in link",
      preheader: "Use this one-time link to sign in to Relay.",
      hero: "magic_link",
      heading: "Your magic link is ready",
      body: `
        ${p(greeting)}
        ${p("Use the button below to sign in to Relay. It takes you straight to your account, no password needed.")}
        ${button("{{ .ConfirmationURL }}", "Sign in to Relay")}
        ${note("The link works once and expires soon.")}
        ${fallback("{{ .ConfirmationURL }}")}
        ${safety("Didn't request this?", "You can safely ignore this email.")}`,
    }),
  },
  email_change: {
    subject: "Confirm your new Relay email",
    html: layout({
      title: "Confirm your new email",
      preheader: "Confirm the change of your Relay email address.",
      hero: "email_change",
      heading: "Confirm your new email",
      body: `
        ${p(greeting)}
        ${p("You asked to change the email address on your Relay account. Confirm the change to continue.")}
        ${panel([["From", "{{ .Email }}"], ["To", "{{ .NewEmail }}"]])}
        ${button("{{ .ConfirmationURL }}", "Confirm change")}
        ${note("The link works once and expires soon.")}
        ${fallback("{{ .ConfirmationURL }}")}
        ${safety("Didn't ask for this?", "Ignore this email and tell your admin, because someone may have access to your account.")}`,
    }),
  },
  reauthentication: {
    subject: "Your Relay confirmation code",
    html: layout({
      title: "Your confirmation code",
      preheader: "Enter this code to confirm it is you.",
      hero: "reauthentication",
      heading: "Verify it's still you",
      body: `
        ${p(greeting)}
        ${p("We noticed a sensitive change on your account. Enter this code in Relay to confirm it is you:")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 10px;"><tr><td align="center" bgcolor="${TAUPE}" style="background:${TAUPE};border-radius:14px;padding:22px 16px;font:500 34px/1 ${MONO};letter-spacing:0.3em;color:${INK};">{{ .Token }}</td></tr></table>
        ${note("The code expires soon. Never share it with anyone.")}
        ${safety("Didn't request this?", "You can safely ignore this email.")}`,
    }),
  },
};

mkdirSync("supabase/templates", { recursive: true });
let readme = "# Auth email templates\n\nGenerated by `npm run emails:build` from `scripts/build-email-templates.mjs` (images from `scripts/build-email-assets.mjs`). Edit the scripts, not the HTML.\n\nPaste each file into **Supabase → Authentication → Emails → Templates** and use the subject shown.\n\n| Template in Supabase | File | Subject |\n|---|---|---|\n";
const names = { invite: "Invite user", recovery: "Reset password", confirmation: "Confirm sign up", magic_link: "Magic link", email_change: "Change email address", reauthentication: "Reauthentication" };
for (const [key, { subject, html }] of Object.entries(templates)) {
  writeFileSync(`supabase/templates/${key}.html`, html);
  readme += `| ${names[key]} | \`${key}.html\` | ${subject} |\n`;
}
readme += "\nInvite and reset links go to `{{ .SiteURL }}/set-password?token_hash=…`, so **Site URL** in Authentication → URL Configuration must be your app's public URL. The emails also load their images from `{{ .SiteURL }}/brand/email/…`, so the app must be deployed for the artwork and logo to show. Relay never uses sign-up confirmation or magic links (sign-up is off), but they are styled so every email matches.\n";
writeFileSync("supabase/templates/README.md", readme);
console.log(`Wrote ${Object.keys(templates).length} templates to supabase/templates/`);
