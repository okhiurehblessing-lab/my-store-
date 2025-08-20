import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Store from "./pages/Store";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import AdminPanel from "./pages/AdminPanel";
import Navbar from "./components/Navbar";
import WhatsAppFloat from "./components/WhatsAppFloat";

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/store" element={<Store />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
      <WhatsAppFloat />
    </>
  );
}
