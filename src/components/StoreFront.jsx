// src/components/StoreFront.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Flex, Text, Image, IconButton, Input, InputGroup, InputLeftElement,
  SimpleGrid, Button, useToast, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalFooter, Drawer, DrawerOverlay, DrawerContent, DrawerHeader,
  DrawerBody, DrawerFooter, Tag, HStack, VStack, Divider, Textarea, RadioGroup,
  Stack, Radio, Badge, Spinner
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { FiShoppingCart, FiSearch, FiX, FiChevronLeft, FiChevronRight, FiSettings } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { db } from "../firebase";
import {
  collection, doc, onSnapshot, query, orderBy, addDoc, getDoc, updateDoc, serverTimestamp
} from "firebase/firestore";
import { sendAdminOrderEmail, sendCustomerOrderEmail } from "../utils/email";

const CLOUD_NAME = "desbqctik";        // update if you changed cloud name
const UPLOAD_PRESET = "myshop_preset"; // update if you changed preset

const formatN = (n) => "₦" + (Number(n || 0)).toLocaleString();

export default function StoreFront() {
  const toast = useToast();

  // app settings stored in Firestore at settings/store
  const [settings, setSettings] = useState({
    storeName: "Essyessentials",
    logoUrl: "/assets/logo.jpg",
    announcement: "Welcome to Essyessentials",
    announcementPopup: { on: false, title: "", body: "" },
    whatsapp: "",
    contactEmail: "",
    bank: { accountName: "", accountNumber: "", bankName: "" },
    theme: { button: "#6d28d9" },
    shippingBlocks: [],
    allowPickup: true,
    allowAddressNotThere: true
  });

  // data
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);

  // UI
  const [q, setQ] = useState("");
  const [activeCollection, setActiveCollection] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productImageIndex, setProductImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // cart stored in localStorage for persistence
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cart") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => localStorage.setItem("cart", JSON.stringify(cart)), [cart]);

  // checkout fields
  const fileRef = useRef(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [address, setAddress] = useState({ line: "", city: "", state: "" });
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  // load live Firestore: settings, collections, products
  useEffect(() => {
    setLoading(true);
    const sRef = doc(db, "settings", "store");
    const unsubSettings = onSnapshot(sRef, (snap) => {
      if (snap.exists()) setSettings((p) => ({ ...p, ...snap.data() }));
    });

    const colQ = query(collection(db, "collections"), orderBy("name", "asc"));
    const unsubCollections = onSnapshot(colQ, (snap) => {
      setCollections(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const prodQ = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubProducts = onSnapshot(prodQ, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubSettings(); unsubCollections(); unsubProducts();
    };
  }, []);

  // derived visible products
  const visibleProducts = useMemo(() => {
    const qq = (q || "").trim().toLowerCase();
    return products.filter((p) => {
      const matchesQ = !qq || (p.name || "").toLowerCase().includes(qq) || (p.description || "").toLowerCase().includes(qq);
      const inCollection = !activeCollection || (p.collections || []).includes(activeCollection) || p.collection === activeCollection;
      const inStock = p.stock === undefined || p.stock > 0 || p.allowBackorder;
      return matchesQ && inCollection; // show out of stock too but mark it later
    });
  }, [products, q, activeCollection]);

  // CART operations
  function addToCart(product, opts = {}) {
    // opts: qty, color, size
    const qty = opts.qty || 1;
    // allow adding even without options; default selections taken
    setCart((prev) => {
      const matchIndex = prev.findIndex(
        (it) => it.id === product.id && (it.color || null) === (opts.color || null) && (it.size || null) === (opts.size || null)
      );
      if (matchIndex > -1) {
        const copy = [...prev];
        copy[matchIndex].qty += qty;
        return copy;
      }
      const item = {
        id: product.id,
        name: product.name,
        price: product.price,
        originalCost: product.originalCost || 0,
        image: (product.images && product.images[0]) || "/assets/placeholder.jpg",
        qty,
        color: opts.color || null,
        size: opts.size || null
      };
      return [...prev, item];
    });
    toast({ title: "Added to cart", status: "success", duration: 1500 });
  }

  function incQty(index) {
    setCart((c) => c.map((it, i) => i === index ? { ...it, qty: it.qty + 1 } : it));
  }
  function decQty(index) {
    setCart((c) => c.map((it, i) => i === index ? { ...it, qty: Math.max(1, it.qty - 1) } : it));
  }
  function removeFromCart(index) {
    setCart((c) => c.filter((_, i) => i !== index));
  }
  function clearCart() {
    setCart([]);
  }
  const cartCount = cart.reduce((s, it) => s + (it.qty || 0), 0);
  const cartSubtotal = cart.reduce((s, it) => s + (Number(it.price || 0) * (it.qty || 0)), 0);

  // product modal open
  function openProductModal(product) {
    setSelectedProduct(product);
    setProductImageIndex(0);
    setProductModalOpen(true);
  }
  function closeProductModal() {
    setSelectedProduct(null);
    setProductModalOpen(false);
  }

  // cloudinary unsigned upload
  async function uploadToCloudinary(file) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: fd
    });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Upload failed");
    return data.secure_url;
  }

  // shipping selection object
  const shippingOptions = useMemo(() => {
    const blocks = settings.shippingBlocks || [];
    const opts = [
      ...blocks.map(b => ({ id: b.id, title: b.title, fee: Number(b.fee || 0), desc: b.desc || "" }))
    ];
    if (settings.allowPickup) opts.unshift({ id: "pickup", title: "Pickup", fee: 0, desc: "Pickup from store" });
    if (settings.allowAddressNotThere) opts.push({ id: "address-not-listed", title: "Address not listed", fee: 0, desc: "Admin will contact you for delivery fee" });
    opts.push({ id: "stockpile", title: "Stockpile (reserve)", fee: 0, desc: "Reserve items and pay later" });
    return opts;
  }, [settings]);

  const selectedShippingObj = useMemo(() => {
    return shippingOptions.find(s => s.id === selectedShipping) || { id: null, title: "", fee: 0, desc: "" };
  }, [selectedShipping, shippingOptions]);

  // PLACE ORDER
  async function placeOrder(e) {
    e?.preventDefault?.();
    if (cart.length === 0) { toast({ title: "Cart is empty", status: "error" }); return; }
    if (!customer.name || !customer.email || !customer.phone) { toast({ title: "Fill name, email and phone", status: "error" }); return; }
    if (!selectedShipping) { toast({ title: "Choose shipping method", status: "error" }); return; }

    const requiresProof = !(selectedShipping === "stockpile" || selectedShipping === "address-not-listed");
    setPlacingOrder(true);

    try {
      let proofUrl = null;
      if (requiresProof) {
        const file = fileRef.current?.files?.[0];
        if (!file) { toast({ title: "Upload payment proof", status: "error" }); setPlacingOrder(false); return; }
        proofUrl = await uploadToCloudinary(file);
      }

      const orderId = Date.now() + Math.floor(Math.random() * 9000);
      const orderDoc = {
        orderId,
        items: cart,
        subtotal: cartSubtotal,
        shipping: selectedShippingObj,
        total: cartSubtotal + Number(selectedShippingObj.fee || 0),
        customer,
        address,
        paymentProof: proofUrl,
        status: (selectedShipping === "stockpile" ? "Stockpile" : (selectedShipping === "address-not-listed" ? "Pending Delivery Fee" : "Awaiting Confirmation")),
        createdAt: serverTimestamp()
      };

      // save order
      await addDoc(collection(db, "orders"), orderDoc);

      // decrement stock (only if not stockpile)
      if (selectedShipping !== "stockpile") {
        for (const it of cart) {
          try {
            const pRef = doc(db, "products", it.id);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
              const cur = pSnap.data().stock || 0;
              await updateDoc(pRef, { stock: Math.max(0, cur - (it.qty || 0)) });
            }
          } catch (err) {
            console.warn("stock update error", err);
          }
        }
      }

      // send emails once each (customer + admin)
      const itemsText = cart.map(i => `${i.name} x${i.qty} @ ${formatN(i.price)}`).join("\n");
      const payload = {
        customer_name: customer.name,
        order_id: String(orderId),
        order_items: itemsText,
        total_amount: formatN(orderDoc.total),
        delivery_address: (address.line || "") + (address.city ? `, ${address.city}` : "") + (address.state ? `, ${address.state}` : ""),
        shipping_method: selectedShippingObj.title || ""
      };

      try {
        await sendCustomerOrderEmail(payload);
        await sendAdminOrderEmail(payload);
      } catch (e) {
        console.warn("EmailJS send error", e);
      }

      // success
      clearCart();
      setCheckoutOpen(false);
      setCartOpen(false);
      toast({ title: "Order placed. Admin will contact you.", status: "success", duration: 4000 });
    } catch (err) {
      console.error("placeOrder error", err);
      toast({ title: "Order failed", status: "error" });
    } finally {
      setPlacingOrder(false);
    }
  }

  // small UI helpers
  const toastOpts = (title, status = "info") => ({ title, status, duration: 3000, isClosable: true });

  // small spinner when loading products
  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Spinner size="xl" />
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg={settings.theme?.bg || "#fff"} color={settings.theme?.text || "#0b1220"}>
      {/* announcement banner */}
      <Box bg="#f3f0ff" p={3} textAlign="center" fontWeight="700">
        {settings.announcement || "Welcome to Essyessentials"}
      </Box>

      {/* header */}
      <Flex align="center" justify="space-between" p={4} maxW="1100px" mx="auto">
        <Flex align="center" gap={3}>
          <Image src={settings.logoUrl || "/assets/logo.jpg"} boxSize="56px" objectFit="cover" borderRadius="8px" alt="logo" />
          <Box>
            <Text fontWeight="700">{settings.storeName || "Essyessentials"}</Text>
            <Text fontSize="sm" color="gray.500">{settings.tagline || ""}</Text>
          </Box>
        </Flex>

        <Flex align="center" gap={3}>
          <InputGroup maxW="360px">
            <InputLeftElement pointerEvents="none"><SearchIcon color="gray.400" /></InputLeftElement>
            <Input placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>

          <IconButton aria-label="account" icon={<FiUser />} />

          <Box position="relative">
            <IconButton aria-label="cart" icon={<FiShoppingCart />} onClick={() => setCartOpen(true)} />
            {cartCount > 0 && <Badge position="absolute" top="-1" right="-1" colorScheme="purple">{cartCount}</Badge>}
          </Box>
        </Flex>
      </Flex>

      {/* collections row */}
      <Flex gap={3} py={2} px={4} maxW="1100px" mx="auto" overflowX="auto">
        <Button size="sm" variant={activeCollection === "" ? "solid" : "ghost"} onClick={() => setActiveCollection("")}>All</Button>
        {collections.map((c) => (
          <Button key={c.id} size="sm" variant={activeCollection === c.name ? "solid" : "ghost"} onClick={() => setActiveCollection(c.name)}>{c.name}</Button>
        ))}
      </Flex>

      {/* bold announcement area */}
      <Box px={4} maxW="1100px" mx="auto" my={4}>
        <Box bg="#f7f7ff" p={4} borderRadius="8px" fontWeight="700">
          {settings.announcement || "Announcements here"}
        </Box>
      </Box>

      {/* product grid */}
      <Box px={4} maxW="1100px" mx="auto">
        <SimpleGrid columns={[2, 2, 3]} spacing={4}>
          {visibleProducts.map((p) => (
            <Box key={p.id} borderRadius="10px" border="1px solid #eee" overflow="hidden" bg="#fff">
              <Image
                src={(p.images && p.images[0]) || "/assets/placeholder.jpg"}
                alt={p.name}
                objectFit="cover"
                height="220px"
                width="100%"
                cursor="pointer"
                onClick={() => openProductModal(p)}
              />
              <Box p={3}>
                <Text fontWeight="600" userSelect="text">{p.name}</Text>
                <Text fontSize="sm" color="gray.500" noOfLines={2}>{p.description}</Text>
                <Flex align="center" justify="space-between" mt={2}>
                  <Text fontWeight="700">{formatN(p.price)}</Text>
                  <Button size="sm" colorScheme="purple" onClick={() => addToCart(p, { qty: 1 })}>Add</Button>
                </Flex>
                {p.stock !== undefined && <Text fontSize="sm" mt={2} color={p.stock > 0 ? "green.600" : "red.500"}>{p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</Text>}
              </Box>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      {/* footer */}
      <Box mt={8} p={6} bg="#fafafa" textAlign="center">
        <Text>Contact us: <a href={`mailto:${settings.contactEmail || ""}`}>{settings.contactEmail || "—"}</a> • WhatsApp: <a href={`https://wa.me/${settings.whatsapp || ""}`} target="_blank" rel="noreferrer">{settings.whatsapp || "—"}</a></Text>
        <Text mt={2} color="gray.500">© {new Date().getFullYear()} {settings.storeName || "Essyessentials"}</Text>
      </Box>

      {/* product modal */}
      <Modal isOpen={productModalOpen} onClose={closeProductModal} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selectedProduct?.name}</ModalHeader>
          <ModalBody>
            <Flex gap={4}>
              <Box flex="1">
                <Image src={selectedProduct?.images?.[productImageIndex] || "/assets/placeholder.jpg"} alt={selectedProduct?.name} borderRadius="8px" mb={3} />
                <Flex gap={2}>
                  {(selectedProduct?.images || []).map((u, i) => (
                    <Image key={i} src={u} boxSize="56px" objectFit="cover" borderRadius="6px" cursor="pointer" onClick={() => setProductImageIndex(i)} />
                  ))}
                </Flex>
              </Box>
              <Box flex="1">
                <Text fontWeight="700" fontSize="xl">{selectedProduct && formatN(selectedProduct.price)}</Text>
                <Text mt={2}>{selectedProduct?.description}</Text>

                <Box mt={4}>
                  <Text fontWeight="600">Colors</Text>
                  <HStack mt={2}>
                    {(selectedProduct?.colors || []).length ? (selectedProduct.colors.map((c) => <Tag key={c}>{c}</Tag>)) : <Text fontSize="sm" color="gray.500">No colors</Text>}
                  </HStack>
                </Box>

                <Box mt={3}>
                  <Text fontWeight="600">Sizes</Text>
                  <HStack mt={2}>
                    {(selectedProduct?.sizes || []).length ? (selectedProduct.sizes.map((s) => <Tag key={s}>{s}</Tag>)) : <Text fontSize="sm" color="gray.500">No sizes</Text>}
                  </HStack>
                </Box>
              </Box>
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="purple" mr={3} onClick={() => { addToCart(selectedProduct, { qty: 1 }); closeProductModal(); }}>Add to cart</Button>
            <Button onClick={closeProductModal}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* cart drawer */}
      <Drawer isOpen={cartOpen} onClose={() => setCartOpen(false)} placement="right" size="sm">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerHeader display="flex" justifyContent="space-between" alignItems="center">
            <Text>Your cart</Text>
            <Button size="sm" variant="ghost" onClick={() => clearCart()}>Clear cart</Button>
          </DrawerHeader>
          <DrawerBody>
            {cart.length === 0 ? (
              <Box>
                <Text>Your cart is currently empty</Text>
                <Button mt={3} onClick={() => setCartOpen(false)}>Return to shop</Button>
              </Box>
            ) : (
              cart.map((it, idx) => (
                <Flex key={idx} align="center" gap={3} mb={3} borderBottom="1px dashed #eee" pb={3}>
                  <Image src={it.image} boxSize="64px" objectFit="cover" borderRadius="8px" />
                  <Box flex="1">
                    <Text userSelect="text">{it.name}</Text>
                    <Text color="gray.500">{formatN(it.price)} • Qty: {it.qty}</Text>
                    <HStack mt={2}>
                      <Button size="xs" onClick={() => decQty(idx)}>-</Button>
                      <Button size="xs" onClick={() => incQty(idx)}>+</Button>
                      <Button size="xs" onClick={() => removeFromCart(idx)}>Remove</Button>
                    </HStack>
                  </Box>
                </Flex>
              ))
            )}
          </DrawerBody>
          <DrawerFooter flexDir="column" gap={3}>
            <Flex justify="space-between" w="100%"><Text>Subtotal</Text><Text fontWeight="700">{formatN(cartSubtotal)}</Text></Flex>
            <Flex justify="space-between" w="100%"><Button onClick={() => setCartOpen(false)}>Continue shopping</Button><Button colorScheme="purple" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Proceed to checkout</Button></Flex>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* checkout modal */}
      <Modal isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Checkout</ModalHeader>
          <ModalBody>
            <VStack spacing={3} align="stretch">
              <Text fontWeight="600">Customer</Text>
              <Input placeholder="Full name" value={customer.name} onChange={(e) => setCustomer(s => ({ ...s, name: e.target.value }))} />
              <Input placeholder="Email" value={customer.email} onChange={(e) => setCustomer(s => ({ ...s, email: e.target.value }))} />
              <Input placeholder="Phone" value={customer.phone} onChange={(e) => setCustomer(s => ({ ...s, phone: e.target.value }))} />
              <Textarea placeholder="Delivery address (line, city, state)" value={`${address.line}${address.city ? ", " + address.city : ""}${address.state ? ", " + address.state : ""}`} onChange={(e) => {
                const parts = e.target.value.split(",").map(p => p.trim());
                setAddress({ line: parts[0] || "", city: parts[1] || "", state: parts[2] || "" });
              }} />

              <Divider />
              <Text fontWeight="600">Shipping</Text>
              <RadioGroup value={selectedShipping} onChange={(val) => setSelectedShipping(val)}>
                <Stack>
                  {shippingOptions.map(sb => (
                    <Radio key={sb.id} value={sb.id}>
                      <Box>
                        <Text fontWeight="700">{sb.title} {sb.fee ? `• ${formatN(sb.fee)}` : ""}</Text>
                        <Text fontSize="sm" color="gray.500">{sb.desc}</Text>
                      </Box>
                    </Radio>
                  ))}
                </Stack>
              </RadioGroup>

              <Divider />
              <Text fontWeight="600">Payment</Text>
              <Box>
                <Text><strong>Account name:</strong> {settings.bank?.accountName || "—"}</Text>
                <Text><strong>Account number:</strong> {settings.bank?.accountNumber || "—"} <Button size="xs" ml={2} onClick={() => { navigator.clipboard?.writeText(settings.bank?.accountNumber || ""); toast(toastOpts("Copied account number", "success")); }}>Copy</Button></Text>
                <Text><strong>Bank:</strong> {settings.bank?.bankName || "—"}</Text>
              </Box>

              {/* upload proof except for stockpile & address-not-listed */}
              {selectedShipping && !(selectedShipping === "stockpile" || selectedShipping === "address-not-listed") && (
                <Box>
                  <Text>Upload payment proof</Text>
                  <Input type="file" ref={fileRef} accept="image/*" />
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Flex w="100%" justify="space-between" align="center">
              <Box>
                <Text>Subtotal: {formatN(cartSubtotal)}</Text>
                <Text>Shipping: {formatN(selectedShippingObj.fee || 0)}</Text>
                <Text fontWeight="700">Total: {formatN(cartSubtotal + Number(selectedShippingObj.fee || 0))}</Text>
              </Box>
              <Box>
                <Button mr={3} onClick={() => setCheckoutOpen(false)}>Back</Button>
                <Button colorScheme="purple" onClick={placeOrder} isLoading={placingOrder}>Place order</Button>
              </Box>
            </Flex>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* WhatsApp float */}
      {settings.whatsapp && (
        <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noreferrer">
          <Box position="fixed" right="16px" bottom="16px" bg="#25D366" w="56px" h="56px" borderRadius="full" display="grid" placeItems="center" boxShadow="lg">
            <FiWhatsapp size={22} color="#fff" />
          </Box>
        </a>
      )}
    </Box>
  );
}
