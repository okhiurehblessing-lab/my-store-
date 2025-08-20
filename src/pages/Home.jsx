// src/pages/Home.jsx
import React from "react";
import { Box, Button, Flex, Image, SimpleGrid, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import ProductCard from "../components/ProductCard";

export default function Home(){
  const { settings, visibleProducts } = useSettings();
  const featured = visibleProducts.slice(0, 6);

  return (
    <Box>
      <Flex bg="#f7f5ff" align="center" justify="center" py={10} px={4}>
        <Box maxW="1100px" w="100%">
          <Text fontSize="3xl" fontWeight="800">{settings.storeName || "Essyessentials"}</Text>
          <Text color="gray.600" mt={2}>{settings.tagline || "Quality essentials at great prices."}</Text>
          <Button as={Link} to="/store" mt={4} colorScheme="purple">Shop now</Button>
        </Box>
      </Flex>

      <Box maxW="1100px" mx="auto" px={4} py={8}>
        <Flex justify="space-between" align="center" mb={3}>
          <Text fontWeight="700" fontSize="xl">New arrivals</Text>
          <Button as={Link} to="/store" variant="ghost" colorScheme="purple">See all</Button>
        </Flex>
        <SimpleGrid columns={[2,2,3]} spacing={4}>
          {featured.map(p => <ProductCard key={p.id} p={p} onOpen={()=>{}} />)}
        </SimpleGrid>
      </Box>

      <Box maxW="1100px" mx="auto" px={4} py={8}>
        <Image src={settings.bannerUrl || "https://via.placeholder.com/1100x280?text=Essy+Essentials"} borderRadius="md" />
      </Box>
    </Box>
  );
}
