/**
 * Playwright test accounts (profiles.is_test) are hidden from the UI. The test suite sets
 * NEXT_PUBLIC_SHOW_TEST_USERS=1 for its dev server so it can still drive them through the screens.
 */
export const SHOW_TEST_USERS = process.env.NEXT_PUBLIC_SHOW_TEST_USERS === "1";
