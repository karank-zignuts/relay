/** Runs in <head> before first paint, so the page never flashes light before dark. Keep in step with lib/theme.tsx. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("relay-theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches)){var r=document.documentElement;r.classList.add("dark");r.style.colorScheme="dark"}}catch(e){}`;
