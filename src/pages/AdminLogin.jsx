import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Box, Input, Button, Text } from "@chakra-ui/react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Invalid login, try again.");
    }
  };

  return (
    <Box maxW="400px" mx="auto" mt={20} p={5} border="1px solid #ddd" borderRadius="md">
      <Text fontSize="xl" mb={4} fontWeight="bold">Admin Login</Text>
      <form onSubmit={handleLogin}>
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} mb={3}/>
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} mb={3}/>
        {error && <Text color="red.500" mb={2}>{error}</Text>}
        <Button type="submit" colorScheme="purple" w="100%">Login</Button>
      </form>
    </Box>
  );
}
