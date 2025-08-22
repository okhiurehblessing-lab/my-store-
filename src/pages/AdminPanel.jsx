// src/pages/AdminPanel.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  Box, Button, Flex, Input, Textarea, Image, Text, HStack, VStack, Divider,
  Tag, SimpleGrid, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, Select, Badge, Table, Thead, Tbody, Tr, Th, Td, IconButton,
  Spinner, FormControl, FormLabel, useToast, Stack
} from "@chakra-ui/react";
import { db, auth } from "../firebase";
import {
  collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc
} from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { sendAdminOrderEmail, sendCustomerOrderEmail } from "../utils/email";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Upload helper
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

export default function AdminPanel() {
  const toast = useToast();

  // ---- AUTH ----
  const [adminUser, setAdminUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAdminUser(u));
    return () => unsub();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      toast({ title: "Logged in", status: "success" });
    } catch (err) {
      console.error(err);
      toast({ title: "Login failed", status: "error" });
    } finally {
      setLoginLoading(false);
    }
  }

  if (!adminUser) {
    return (
      <Box maxW="480px" mx="auto" mt={16} p={6} border="1px solid #eee" borderRadius="md">
        <Text fontSize="2xl" fontWeight="800" mb={4}>Admin login</Text>
        <form onSubmit={handleLogin}>
          <Input placeholder="Email" mb={3} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
          <Input placeholder="Password" mb={3} type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
          <Button type="submit" colorScheme="purple" isLoading={loginLoading} w="100%">Login</Button>
        </form>
        <Text mt={3} fontSize="sm" color="gray.600">
          If you don't have admin credentials yet, create a user in Firebase Console → Authentication → Add user.
        </Text>
      </Box>
    );
  }

  // ----- STATE: data from Firestore -----
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    setLoadingData(true);
    const unsubP = onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")),
      (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubC = onSnapshot(query(collection(db, "collections"), orderBy("name", "asc")),
      (snap) => setCollections(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubO = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubS = onSnapshot(doc(db, "settings", "store"),
      (snap) => setSettings(snap.exists() ? snap.data() : null));

    setLoadingData(false);
    return () => { unsubP(); unsubC(); unsubO(); unsubS(); };
  }, []);

  // ----- PRODUCT FORM (add / edit) -----
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "", price: "", originalCost: "", description: "", stock: 0,
    colorsText: "", sizesText: "", selectedCollections: [], imagesPreview: [], newFiles: []
  });
  const imagesInputRef = useRef();

  useEffect(() => {
    if (!editing) {
      setForm({
        name: "", price: "", originalCost: "", description: "", stock: 0,
        colorsText: "", sizesText: "", selectedCollections: [], imagesPreview: [], newFiles: []
      });
      if (imagesInputRef.current) imagesInputRef.current.value = "";
    } else {
      setForm({
        name: editing.name || "",
        price: String(editing.price || ""),
        originalCost: String(editing.originalCost || ""),
        description: editing.description || "",
        stock: editing.stock || 0,
        colorsText: (editing.colors || []).join("\n"),
        sizesText: (editing.sizes || []).join("\n"),
        selectedCollections: editing.collections || [],
        imagesPreview: (editing.images || []).slice(),
        newFiles: []
      });
      if (imagesInputRef.current) imagesInputRef.current.value = "";
    }
  }, [editing]);

  function handleFilesChange(e) {
    const files = Array.from(e.target.files || []);
    setForm((f) => ({ ...f, newFiles: files, imagesPreview: [...(f.imagesPreview || []), ...files.map(file => URL.createObjectURL(file))] }));
  }

  async function handleAddOrUpdateProduct(e) {
    e?.preventDefault?.();
    if (!form.name || !form.price) { toast({ title: "Name and price required", status: "error" }); return; }

    try {
      let uploadedUrls = [];
      for (const f of (form.newFiles || [])) {
        const url = await uploadToCloudinary(f);
        uploadedUrls.push(url);
      }

      const colors = (form.colorsText || "").split("\n").map(s => s.trim()).filter(Boolean);
      const sizes = (form.sizesText || "").split("\n").map(s => s.trim()).filter(Boolean);

      const docData = {
        name: form.name,
        price: Number(form.price || 0),
        originalCost: Number(form.originalCost || 0),
        description: form.description,
        stock: Number(form.stock || 0),
        colors,
        sizes,
        collections: form.selectedCollections || [],
        createdAt: editing ? editing.createdAt || serverTimestamp() : serverTimestamp()
      };

      if (editing) {
        const pRef = doc(db, "products", editing.id);
        const existing = editing.images || [];
        const newImages = [...existing, ...uploadedUrls];
        await updateDoc(pRef, { ...docData, images: newImages });
        toast({ title: "Product updated", status: "success" });
        setEditing(null);
      } else {
        await addDoc(collection(db, "products"), { ...docData, images: uploadedUrls });
        toast({ title: "Product added", status: "success" });
      }

      setForm({
        name: "", price: "", originalCost: "", description: "", stock: 0,
        colorsText: "", sizesText: "", selectedCollections: [], imagesPreview: [], newFiles: []
      });
      if (imagesInputRef.current) imagesInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      toast({ title: "Save failed", status: "error" });
    }
  }

  // ----- COLLECTIONS -----
  async function createCollection() {
    const name = prompt("Collection name");
    if (!name) return;
    try {
      await addDoc(collection(db, "collections"), { name });
      toast({ title: "Collection created", status: "success" });
    } catch (err) {
      console.error(err);
      toast({ title: "Create failed", status: "error" });
    }
  }

  // ----- ORDERS -----
  const [orderView, setOrderView] = useState(null);

  async function updateOrderStatus(o, status) {
    try {
      await updateDoc(doc(db, "orders", o.id), { status });
      const payload = {
        customer_name: o.customer_name || "",
        customer_email: o.customer_email || "",
        order_id: String(o.order_id || o.id),
        order_items: o.order_items || "",
        total_amount: o.total_amount || 0,
      };
      await sendCustomerOrderEmail(payload);
      toast({ title: "Order status updated", status: "success" });
      setOrderView(null);
    } catch (err) {
      console.error(err);
      toast({ title: "Update failed", status: "error" });
    }
  }

  function computeOrderGains(order) {
    let totalCost = 0;
    let totalSales = 0;
    for (const it of order.items || []) {
      totalCost += Number(it.originalCost || 0) * (it.qty || 0);
      totalSales += Number(it.price || 0) * (it.qty || 0);
    }
    return { totalCost, totalSales, gain: totalSales - totalCost };
  }

  // ----- UI -----
  return (
    <Box maxW="1200px" mx="auto" px={4} py={6}>
      <Flex justify="space-between" align="center" mb={4}>
        <Text fontSize="2xl" fontWeight="800">Admin dashboard</Text>
        <HStack>
          <Button size="sm" colorScheme="purple" onClick={() => window.open("/", "_blank")}>Open store</Button>
          <Button size="sm" colorScheme="red" onClick={() => signOut(auth)}>Logout</Button>
        </HStack>
      </Flex>

      {loadingData ? <Spinner /> : (
        <Stack spacing={6}>
          {/* ... product form, settings, products list, orders (unchanged) ... */}
        </Stack>
      )}
    </Box>
  );
}
