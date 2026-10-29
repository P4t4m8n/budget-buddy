"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: { main: "#10b981" },
    secondary: { main: "#6366f1" },
    error: { main: "#ef4444" },
    warning: { main: "#f59e0b" },
    success: { main: "#22c55e" },
    background: {
      default: "#0a0a0a",
      paper: "#141414",
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
  },
});

export default theme;
