import React, { useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Stack,
  Text,
  Image,
  SimpleGrid,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from "@chakra-ui/react";
import { useCart } from "../context/CartContext";
import {
  FiShoppingCart,
  FiSearch,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiSettings,
  FiUser,
} from "react-icons/fi";
import { sendAdminOrderEmail, sendCustomerOrderEmail } from "../utils/email";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { v4 as uuidv4 } from "uuid";

// Cloudinary config
const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Upload helper
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", uploadPreset);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: fd,
    }
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload failed");
  return data.secure_url;
}

const StoreFront = () => {
  const { cartItems, addToCart, removeFromCart, clearCart } = useCart();
  const [products, setProducts] = useState([
    {
      id: "1",
      name: "Sample Product 1",
      price: 100,
      image: "https://via.placeholder.com/150",
    },
    {
      id: "2",
      name: "Sample Product 2",
      price: 200,
      image: "https://via.placeholder.com/150",
    },
  ]);
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const { isOpen, onOpen, onClose } = useDisclosure();

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Place order handler
  const placeOrder = async () => {
    if (!customer.name || !customer.email) {
      alert("Please fill in your details");
      return;
    }
    if (cartItems.length === 0) {
      alert("Your cart is empty");
      return;
    }

    try {
      const orderId = uuidv4();
      const itemsText = cartItems
        .map((i) => `${i.name} x${i.quantity}`)
        .join(", ");

      const payload = {
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: customer.address,
        order_id: String(orderId),
        order_items: itemsText,
        total_amount: cartItems.reduce(
          (acc, item) => acc + item.price * item.quantity,
          0
        ),
      };

      // Save to Firestore
      await addDoc(collection(db, "orders"), {
        ...payload,
        timestamp: serverTimestamp(),
      });

      // Send emails
      await sendCustomerOrderEmail(payload);
      await sendAdminOrderEmail(payload);

      alert("Order placed successfully!");
      clearCart();
      onClose();
    } catch (err) {
      console.error("Error placing order:", err);
      alert("There was a problem placing your order.");
    }
  };

  return (
    <Box p={4}>
      <Flex justify="space-between" align="center" mb={4}>
        <Heading>My Store</Heading>
        <Flex gap={2}>
          <IconButton aria-label="account" icon={<FiUser />} />
          <IconButton
            aria-label="settings"
            icon={<FiSettings />}
            onClick={() => (window.location.href = "/admin")}
          />
          <IconButton aria-label="cart" icon={<FiShoppingCart />} onClick={onOpen} />
        </Flex>
      </Flex>

      <Flex mb={4}>
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <IconButton aria-label="search" icon={<FiSearch />} />
      </Flex>

      <SimpleGrid columns={[1, 2, 3]} spacing={4}>
        {filteredProducts.map((product) => (
          <Box key={product.id} borderWidth="1px" borderRadius="lg" p={4}>
            <Image src={product.image} alt={product.name} />
            <Text fontWeight="bold">{product.name}</Text>
            <Text>${product.price}</Text>
            <Button onClick={() => addToCart(product)}>Add to Cart</Button>
          </Box>
        ))}
      </SimpleGrid>

      {/* Cart Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Your Cart</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack>
              {cartItems.map((item) => (
                <Flex
                  key={item.id}
                  justify="space-between"
                  align="center"
                  borderBottom="1px solid #eee"
                  pb={2}
                >
                  <Text>
                    {item.name} x{item.quantity}
                  </Text>
                  <Text>${item.price * item.quantity}</Text>
                  <IconButton
                    aria-label="remove"
                    icon={<FiX />}
                    onClick={() => removeFromCart(item.id)}
                  />
                </Flex>
              ))}
              <Box>
                <Heading size="sm">Your Details</Heading>
                <Input
                  placeholder="Name"
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer({ ...customer, name: e.target.value })
                  }
                />
                <Input
                  placeholder="Email"
                  value={customer.email}
                  onChange={(e) =>
                    setCustomer({ ...customer, email: e.target.value })
                  }
                />
                <Input
                  placeholder="Phone"
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer({ ...customer, phone: e.target.value })
                  }
                />
                <Input
                  placeholder="Address"
                  value={customer.address}
                  onChange={(e) =>
                    setCustomer({ ...customer, address: e.target.value })
                  }
                />
              </Box>
              <Button colorScheme="blue" onClick={placeOrder}>
                Place Order
              </Button>
            </Stack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default StoreFront;
