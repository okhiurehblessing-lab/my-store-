// src/pages/AdminPanel.jsx
import React, { useEffect, useRef, useState } from "react";
import { Box, Button, Flex, Input, Textarea, Image, Text, HStack, VStack, Divider, Tag, SimpleGrid } from "@chakra-ui/react";
import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";

const CLOUD_NAME = "desbqctik";
const UPLOAD_PRESET = "myshop_preset";

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

export default function AdminPanel(){
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);

  const nameRef = useRef();
  const priceRef = useRef();
  const descRef = useRef();
  const stockRef = useRef();
  const colorsRef = useRef();
  const sizesRef = useRef();
  const imagesRef = useRef();

  useEffect(()=> {
    const prodQ = query(collection(db, "products"), orderBy("createdAt","desc"));
    const unsubP = onSnapshot(prodQ, snap => setProducts(snap.docs.map(d=> ({ id:d.id, ...d.data() }))));
    const colQ = query(collection(db, "collections"), orderBy("name","asc"));
    const unsubC = onSnapshot(colQ, snap => setCollections(snap.docs.map(d=> ({ id:d.id, ...d.data() }))));
    return ()=>{ unsubP(); unsubC(); };
  }, []);

  async function handleAddOrUpdate(e){
    e.preventDefault();
    const name = nameRef.current.value.trim();
    const price = Number(priceRef.current.value.trim() || 0);
    const description = descRef.current.value.trim();
    const stock = Number(stockRef.current.value.trim()||0);
    const colors = (colorsRef.current.value || "").split("\n").map(s=>s.trim()).filter(Boolean);
    const sizes = (sizesRef.current.value || "").split("\n").map(s=>s.trim()).filter(Boolean);

    const files = imagesRef.current.files || [];
    const uploaded = [];
    for (const f of files) {
      try {
        const url = await uploadToCloudinary(f);
        uploaded.push(url);
      } catch (err) {
        console.warn("upload fail", err);
      }
    }

    const docData = {
      name, price, description, stock, colors, sizes,
      images: uploaded,
      createdAt: serverTimestamp()
    };

    try {
      if (editingProduct) {
        const pRef = doc(db, "products", editingProduct.id);
        await updateDoc(pRef, { ...docData });
        setEditingProduct(null);
      } else {
        await addDoc(collection(db, "products"), docData);
      }
      // clear
      nameRef.current.value = "";
      priceRef.current.value = "";
      descRef.current.value = "";
      stockRef.current.value = "";
      colorsRef.current.value = "";
      sizesRef.current.value = "";
      imagesRef.current.value = "";
    } catch (err) {
      console.error("product save error", err);
    }
  }

  function startEdit(p){
    setEditingProduct(p);
    nameRef.current.value = p.name || "";
    priceRef.current.value = p.price || "";
    descRef.current.value = p.description || "";
    stockRef.current.value = p.stock || 0;
    colorsRef.current.value = (p.colors || []).join("\n");
    sizesRef.current.value = (p.sizes || []).join("\n");
  }

  async function handleDelete(p){
    if (!confirm("Delete product?")) return;
    await deleteDoc(doc(db, "products", p.id));
  }

  async function createCollection(){
    const title = prompt("Collection name");
    if (!title) return;
    await addDoc(collection(db, "collections"), { name: title });
  }

  return (
    <Box maxW="1100px" mx="auto" px={4} py={6}>
      <Text fontSize="2xl" fontWeight="800">Admin panel</Text>
      <HStack spacing={4} mt={4} align="start">
        <VStack align="stretch" flex="1">
          <Box p={4} border="1px solid #eee" borderRadius="md">
            <Text fontWeight="700" mb={2}>{editingProduct ? "Edit product" : "Add new product"}</Text>
            <form onSubmit={handleAddOrUpdate}>
              <Input placeholder="Name" ref={nameRef} mb={2} />
              <Input placeholder="Price (numbers)" ref={priceRef} mb={2} />
              <Textarea placeholder="Description" ref={descRef} mb={2} />
              <Input placeholder="Stock" ref={stockRef} mb={2} />
              <Textarea placeholder="Colors (one per line)" ref={colorsRef} mb={2} />
              <Textarea placeholder="Sizes (one per line)" ref={sizesRef} mb={2} />
              <Input type="file" multiple ref={imagesRef} mb={2} accept="image/*" />
              <Button type="submit" colorScheme="purple" mr={3}>{editingProduct ? "Update" : "Add product"}</Button>
              {editingProduct && <Button onClick={()=> setEditingProduct(null)}>Cancel</Button>}
            </form>
          </Box>

          <Box p={4} border="1px solid #eee" borderRadius="md">
            <Text fontWeight="700" mb={2}>Collections</Text>
            <Button size="sm" onClick={createCollection} mb={3}>Create collection</Button>
            <SimpleGrid columns={[2,3,4]} spacing={2}>
              {collections.map(c => <Tag key={c.id}>{c.name}</Tag>)}
            </SimpleGrid>
          </Box>
        </VStack>

        <Box flex="2">
          <Text fontWeight="700">Products</Text>
          <VStack align="stretch" mt={3} spacing={3}>
            {products.map(p => (
              <Flex key={p.id} p={3} border="1px solid #eee" borderRadius="md" align="center" justify="space-between">
                <Flex align="center" gap={3}>
                  <Image src={(p.images && p.images[0]) || "https://via.placeholder.com/80"} boxSize="80px" objectFit="cover" borderRadius="md"/>
                  <Box>
                    <Text fontWeight="700">{p.name}</Text>
                    <Text color="gray.600">₦{Number(p.price||0).toLocaleString()}</Text>
                  </Box>
                </Flex>
                <HStack>
                  <Button size="sm" onClick={()=> startEdit(p)}>Edit</Button>
                  <Button size="sm" colorScheme="red" onClick={()=> handleDelete(p)}>Delete</Button>
                </HStack>
              </Flex>
            ))}
          </VStack>
        </Box>
      </HStack>
    </Box>
  );
}
