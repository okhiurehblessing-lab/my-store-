// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import StoreFront from "./components/StoreFront";
import AdminPanel from "./components/AdminPanel";

export default function App(){
  return (
    <Routes>
      <Route path="/" element={<StoreFront />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
