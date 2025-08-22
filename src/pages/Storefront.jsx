// src/pages/Store.jsx
import React, { useState } from "react";
import { Box, Button, Flex, HStack, Image, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalOverlay, SimpleGrid, Tag, Text, useDisclosure } from "@chakra-ui/react";
import { useSettings } from "../context/SettingsContext";
import ProductCard from "../components/ProductCard";

export default function Store(){
  const { collections, visibleProducts, activeCollection, setActiveCollection } = useSettings();
  const [selected, setSelected] = useState(null);
  const modal = useDisclosure();

  const open = (p)=>{ setSelected(p); modal.onOpen(); };
  const close = ()=>{ setSelected(null); modal.onClose(); };

  return (
    <Box maxW="1100px" mx="auto" px={4} py={6}>
      <HStack spacing={2} mb={4} overflowX="auto">
        <Button size="sm" variant={activeCollection==="" ? "solid":"ghost"} onClick={()=> setActiveCollection("")}>All</Button>
        {collections.map(c=>(
          <Button key={c.id} size="sm" variant={activeCollection===c.name ? "solid":"ghost"} onClick={()=> setActiveCollection(c.name)}>{c.name}</Button>
        ))}
      </HStack>

      <SimpleGrid columns={[2,2,3]} spacing={4}>
        {visibleProducts.map(p=>(
          <ProductCard key={p.id} p={p} onOpen={()=> open(p)} />
        ))}
      </SimpleGrid>

      <Modal isOpen={modal.isOpen} onClose={close} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selected?.name}</ModalHeader>
          <ModalBody>
            <Flex gap={4} direction={["column","row"]}>
              <Image src={selected?.images?.[0] || "https://via.placeholder.com/400x300?text=Product"} borderRadius="md" flex="1" />
              <Box flex="1">
                <Text fontWeight="700" fontSize="xl">₦{Number(selected?.price||0).toLocaleString()}</Text>
                <Text mt={2}>{selected?.description}</Text>
                {!!(selected?.colors?.length) && (
                  <Box mt={3}><Text fontWeight="600">Colors</Text><HStack mt={1}>{selected.colors.map(c=> <Tag key={c}>{c}</Tag>)}</HStack></Box>
                )}
                {!!(selected?.sizes?.length) && (
                  <Box mt={3}><Text fontWeight="600">Sizes</Text><HStack mt={1}>{selected.sizes.map(s=> <Tag key={s}>{s}</Tag>)}</HStack></Box>
                )}
              </Box>
            </Flex>
          </ModalBody>
          <ModalFooter><Button onClick={close}>Close</Button></ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
