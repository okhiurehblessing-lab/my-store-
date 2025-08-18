// src/index.js
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import App from "./App";
import "./styles.css";

const theme = extendTheme({
  fonts: {
    heading: `'Poppins', Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
    body: `'Poppins', Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
  }
});

createRoot(document.getElementById("root")).render(
  <ChakraProvider theme={theme}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ChakraProvider>
);
