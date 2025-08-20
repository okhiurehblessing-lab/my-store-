// src/components/ProductCard.jsx
import React from "react";
import { Box, Image, Text, Flex, Button } from "@chakra-ui/react";
import useCart from "../hooks/useCart";

const formatN = (n) => "₦" + Number(n||0).toLocaleString();

export default function ProductCard({ p, onOpen }) {
  const { add } = useCart();
  return (
    <Box border="1px solid #eee" borderRadius="10px" overflow="hidden" bg="white">
      <Image
        src={p.images?.[0] || "https://via.placeholder.com/400x300?text=Product"}
        alt={p.name}
        objectFit="cover"
        height="220px"
        width="100%"
        cursor="pointer"
        onClick={onOpen}
      />
      <Box p={3}>
        <Text fontWeight="600">{p.name}</Text>
        <Text fontSize="sm" color="gray.600" noOfLines={2}>{p.description}</Text>
        <Flex align="center" justify="space-between" mt={2}>
          <Text fontWeight="700">{formatN(p.price)}</Text>
          <Button size="sm" colorScheme="purple" onClick={()=> add(p, { qty: 1 })}>Add</Button>
        </Flex>
        {p.stock !== undefined && (
          <Text fontSize="sm" mt={2} color={p.stock>0 ? "green.600" : "red.500"}>
            {p.stock>0 ? `${p.stock} in stock` : "Out of stock"}
          </Text>
        )}
      </Box>
    </Box>
  );
}
