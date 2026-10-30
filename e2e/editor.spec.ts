import { test, expect } from "./fixtures";
import { asRole } from "./roles";
import { openTask } from "./helpers";

asRole("project_manager");

test("the comment toolbar shows which formats are on at the cursor", async ({ page }) => {
  await page.goto("/tasks");
  await openTask(page.getByTestId("task-row").first());
  const drawer = page.getByTestId("task-drawer");
  const box = drawer.getByLabel("Write a comment");
  const tool = (name: string) => drawer.getByRole("button", { name, exact: true });

  await box.click();
  await expect(tool("Bold")).toHaveAttribute("aria-pressed", "false");

  // Keyboard shortcut, button, and moving the caret must all keep the toolbar in step.
  await box.press("ControlOrMeta+b");
  await expect(tool("Bold")).toHaveAttribute("aria-pressed", "true");
  await box.pressSequentially("bold");
  await tool("Italic").click();
  await expect(tool("Italic")).toHaveAttribute("aria-pressed", "true");
  await expect(tool("Bold")).toHaveAttribute("aria-pressed", "true");
  await box.pressSequentially("both");
  await tool("Bulleted list").click();
  await expect(tool("Bulleted list")).toHaveAttribute("aria-pressed", "true");

  await box.press("ControlOrMeta+b");
  await expect(tool("Bold")).toHaveAttribute("aria-pressed", "false");
  await expect(tool("Italic")).toHaveAttribute("aria-pressed", "true");

  // Moving into plain text clears them. Active buttons are filled Ink, not just a tint.
  for (let i = 0; i < 8; i++) await box.press("ArrowLeft"); // Home scrolls the page on macOS, so walk back over "boldboth"
  await expect(tool("Italic")).toHaveAttribute("aria-pressed", "false");
  await tool("Strikethrough").click();
  await page.mouse.move(0, 0); // off the button, so we read the active fill and not the hover shade
  await expect(tool("Strikethrough")).toHaveCSS("background-color", "rgb(0, 0, 0)");
});
