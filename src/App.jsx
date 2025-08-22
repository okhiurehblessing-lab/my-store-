// src/App.jsx
import React, { useEffect, useState } from "react";
import { ChakraProvider, Spinner, Center } from "@chakra-ui/react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./firebase";  // your firebase.js config
import { onAuthStateChanged } from "firebase/auth";

import Storefront from "./pages/Storefront.jsx";
import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import WhatsAppFloat from "./components/WhatsAppFloat"; // 👈 import your float

function PrivateRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/admin/login" />;
  }
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" color="purple.500" />
      </Center>
    );
  }

  return (
    <ChakraProvider>
      <Router>
        <Routes>
          {/* Storefront */}
          <Route path="/" element={<Storefront />} />

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <PrivateRoute user={user}>
                <AdminPanel />
              </PrivateRoute>
            }
          />
        </Routes>

        {/* 👇 Float stays here so it shows everywhere */}
        <WhatsAppFloat /> 
      </Router>
    </ChakraProvider>
  );
}
