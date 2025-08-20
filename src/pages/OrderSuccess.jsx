// src/pages/OrderSuccess.jsx
import React from "react";
import { Box, Button, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";

export default function OrderSuccess(){
  return (
    <Box maxW="600px" mx="auto" px={4} py={10} textAlign="center">
      <Text fontSize="2xl" fontWeight="800">Order placed 🎉</Text>
      <Text mt={2} color="gray.600">We’ve received your order. We’ll reach out shortly.</Text>
      <Button as={Link} to="/store" mt={6} colorScheme="purple">Continue shopping</Button>
    </Box>
  );
}
