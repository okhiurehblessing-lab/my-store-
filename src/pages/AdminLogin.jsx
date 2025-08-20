// src/pages/AdminLogin.jsx
import React, { useState } from "react";
import { Box, Button, Input, Text, VStack, useToast } from "@chakra-ui/react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignup) {
        // Sign up new admin
        await createUserWithEmailAndPassword(auth, email, password);
        toast({ title: "Account created!", status: "success" });
      } else {
        // Log in existing admin
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: "Login successful", status: "success" });
      }
      navigate("/admin");
    } catch (err) {
      toast({ title: "Error", description: err.message, status: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box maxW="400px" mx="auto" mt={20} p={6} border="1px solid #eee" borderRadius="md">
      <Text fontSize="2xl" fontWeight="bold" mb={4}>
        {isSignup ? "Admin Sign Up" : "Admin Login"}
      </Text>
      <form onSubmit={handleAuth}>
        <VStack spacing={3}>
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button
            type="submit"
            colorScheme="purple"
            width="100%"
            isLoading={loading}
          >
            {isSignup ? "Sign Up" : "Login"}
          </Button>
        </VStack>
      </form>
      <Button
        variant="link"
        mt={4}
        onClick={() => setIsSignup(!isSignup)}
      >
        {isSignup
          ? "Already have an account? Log In"
          : "Don't have an account? Sign Up"}
      </Button>
    </Box>
  );
}
