// src/components/Navbar.jsx
import React from "react";
import { Box, Flex, Image, Text, IconButton, Input, InputGroup, InputLeftElement, Badge, Button } from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { Link, useNavigate } from "react-router-dom";
import { FiShoppingCart, FiUser } from "react-icons/fi";
import useCart from "../hooks/useCart";
import { useSettings } from "../context/SettingsContext";

export default function Navbar() {
  const { count } = useCart();
  const { settings, setSearch } = useSettings();
  const nav = useNavigate();

  return (
    <Box borderBottom="1px solid #eee" bg="white" position="sticky" top="0" zIndex="1000">
      <Flex maxW="1100px" mx="auto" p={3} align="center" justify="space-between" gap={3}>
        <Flex as={Link} to="/" align="center" gap={2}>
          <Image src={settings.logoUrl || "https://via.placeholder.com/56?text=EE"} boxSize="48px" borderRadius="md" alt="logo"/>
          <Box>
            <Text fontWeight="700">{settings.storeName || "Essyessentials"}</Text>
            {settings.tagline && <Text fontSize="sm" color="gray.500">{settings.tagline}</Text>}
          </Box>
        </Flex>

        <InputGroup maxW="420px">
          <InputLeftElement pointerEvents="none"><SearchIcon color="gray.400"/></InputLeftElement>
          <Input placeholder="Search products..." onChange={(e)=> setSearch(e.target.value)} />
        </InputGroup>

        <Flex align="center" gap={2}>
          <IconButton aria-label="account" icon={<FiUser />}/>
          <Box position="relative">
            <IconButton aria-label="cart" icon={<FiShoppingCart />} onClick={()=> nav("/checkout")}/>
            {count>0 && <Badge position="absolute" top="-1" right="-1" colorScheme="purple">{count}</Badge>}
          </Box>
          <Button as={Link} to="/store" colorScheme="purple" variant="outline">Store</Button>
          <Button as={Link} to="/admin" ml={2} variant="ghost" size="sm">Admin</Button>
        </Flex>
      </Flex>
    </Box>
  );
}
