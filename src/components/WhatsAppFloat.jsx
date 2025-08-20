// src/components/WhatsAppFloat.jsx
import React from "react";
import { Box } from "@chakra-ui/react";
import { FaWhatsapp } from "react-icons/fa";
import { useSettings } from "../context/SettingsContext";

export default function WhatsAppFloat(){
  const { settings } = useSettings();
  if(!settings.whatsapp) return null;
  return (
    <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noreferrer">
      <Box position="fixed" right="16px" bottom="16px" bg="#25D366" w="56px" h="56px" borderRadius="full" display="grid" placeItems="center" boxShadow="lg">
        <FaWhatsapp size={22} color="#fff" />
      </Box>
    </a>
  );
}
