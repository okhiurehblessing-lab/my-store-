// src/pages/AdminPanel.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  Box, Button, Flex, Input, Textarea, Image, Text, HStack, VStack, Divider,
  Tag, SimpleGrid, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, Select, Badge, Table, Thead, Tbody, Tr, Th, Td, IconButton,
  Spinner, FormControl, FormLabel, useToast, Switch, Stack
} from "@chakra-ui/react";
import { db, auth } from "../firebase";
import {
  collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, getDoc, setDoc
} from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { sendAdminOrderEmail, sendCustomerOrderEmail } from "../utils/email";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Helper: upload single file to Cloudinary, returns secure_url
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
    // Simple login UI inside admin page so it's one file
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

  // subscribe to data
  useEffect(() => {
    setLoadingData(true);
    const prodQ = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubP = onSnapshot(prodQ, (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const colQ = query(collection(db, "collections"), orderBy("name", "asc"));
    const unsubC = onSnapshot(colQ, (snap) => setCollections(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const ordQ = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubO = onSnapshot(ordQ, (snap) => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const sRef = doc(db, "settings", "store");
    const unsubS = onSnapshot(sRef, (snap) => {
      if (snap.exists()) setSettings(snap.data());
      else setSettings(null);
      setLoadingData(false);
    });

    return () => { unsubP(); unsubC(); unsubO(); unsubS(); };
  }, []);

  // ----- PRODUCT FORM (add / edit) -----
  const [editing, setEditing] = useState(null); // product object when editing
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
      // upload new files (if any)
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
        // if new product, images are uploadedUrls; if editing, we merge with existing
        createdAt: editing ? editing.createdAt || serverTimestamp() : serverTimestamp()
      };

      if (editing) {
        const pRef = doc(db, "products", editing.id);
        // merge images: existing images (editing.images) + uploadedUrls
        const existing = editing.images || [];
        const newImages = [...existing, ...uploadedUrls];
        await updateDoc(pRef, { ...docData, images: newImages });
        toast({ title: "Product updated", status: "success" });
        setEditing(null);
      } else {
        await addDoc(collection(db, "products"), { ...docData, images: uploadedUrls });
        toast({ title: "Product added", status: "success" });
      }

      // clear form
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

  function startEditProduct(p) {
    setEditing(p);
  }

  async function handleDeleteProduct(p) {
    if (!confirm("Delete product?")) return;
    try {
      await deleteDoc(doc(db, "products", p.id));
      toast({ title: "Deleted", status: "info" });
    } catch (err) {
      console.error(err);
      toast({ title: "Delete failed", status: "error" });
    }
  }

  // assign collections modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetProduct, setAssignTargetProduct] = useState(null);
  const [assignSelected, setAssignSelected] = useState([]);

  function openAssignModal(p) {
    setAssignTargetProduct(p);
    setAssignSelected(p.collections || []);
    setAssignModalOpen(true);
  }
  async function saveAssignCollections() {
    if (!assignTargetProduct) return;
    try {
      await updateDoc(doc(db, "products", assignTargetProduct.id), { collections: assignSelected });
      toast({ title: "Collections updated", status: "success" });
      setAssignModalOpen(false);
      setAssignTargetProduct(null);
    } catch (err) {
      console.error(err);
      toast({ title: "Update failed", status: "error" });
    }
  }

  // ----- Collections: create -----
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

  // ----- SETTINGS -----
  const [settingsDraft, setSettingsDraft] = useState(null);
  const logoInputRef = useRef();

  useEffect(() => {
    if (settings) setSettingsDraft(settings);
  }, [settings]);

  async function uploadLogoAndSave(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = await uploadToCloudinary(f);
      setSettingsDraft((s) => ({ ...s, logoUrl: url }));
      toast({ title: "Logo uploaded", status: "success" });
    } catch (err) {
      console.error(err);
      toast({ title: "Logo upload failed", status: "error" });
    }
  }

  function addShippingBlock() {
    const id = Date.now().toString();
    const next = [...(settingsDraft?.shippingBlocks || []), { id, title: "", fee: 0, desc: "" }];
    setSettingsDraft((s) => ({ ...s, shippingBlocks: next }));
  }
  function updateShippingBlock(idx, field, value) {
    const next = (settingsDraft.shippingBlocks || []).slice();
    next[idx] = { ...next[idx], [field]: value };
    setSettingsDraft((s) => ({ ...s, shippingBlocks: next }));
  }
  function removeShippingBlock(idx) {
    const next = (settingsDraft.shippingBlocks || []).slice();
    next.splice(idx, 1);
    setSettingsDraft((s) => ({ ...s, shippingBlocks: next }));
  }

  async function saveSettings() {
    try {
      await setDoc(doc(db, "settings", "store"), settingsDraft, { merge: true });
      toast({ title: "Settings saved", status: "success" });
    } catch (err) {
      console.error(err);
      toast({ title: "Save failed", status: "error" });
    }
  }

  // ----- ORDERS -----
  const [orderView, setOrderView] = useState(null);
  const [orderStatusUpdating, setOrderStatusUpdating] = useState(false);

  async function openOrder(o) {
    setOrderView(o);
  }

  async function updateOrderStatus(o, status) {
    setOrderStatusUpdating(true);
    try {
      await updateDoc(doc(db, "orders", o.id), { status });
      // optionally send email to customer notifying status change
      const payload = {
        customer_name: o.customer?.name || "",
        order_id: String(o.orderId || ""),
        order_items: (o.items || []).map(i => `${i.name} x${i.qty}`).join("\n"),
        total_amount: `₦${Number(o.total || 0).toLocaleString()}`,
        delivery_address: (o.address ? `${o.address.line || ""}, ${o.address.city || ""}, ${o.address.state || ""}` : ""),
        shipping_method: (o.shipping?.title || "")
      };
      try { await sendCustomerOrderEmail(payload); } catch (e) { console.warn("email send fail", e); }
      toast({ title: "Order status updated", status: "success" });
      setOrderView(null);
    } catch (err) {
      console.error(err);
      toast({ title: "Update failed", status: "error" });
    } finally {
      setOrderStatusUpdating(false);
    }
  }

  // compute admin gains per order (originalCost vs price): available in order items if saved
  function computeOrderGains(order) {
    let totalCost = 0;
    let totalSales = 0;
    for (const it of order.items || []) {
      const oc = Number(it.originalCost || 0);
      const sale = Number(it.price || 0);
      totalCost += oc * (it.qty || 0);
      totalSales += sale * (it.qty || 0);
    }
    return { totalCost, totalSales, gain: totalSales - totalCost };
  }

  // ----- UI rendering -----
  return (
    <Box maxW="1200px" mx="auto" px={4} py={6}>
      <Flex justify="space-between" align="center" mb={4}>
        <Text fontSize="2xl" fontWeight="800">Admin dashboard</Text>
        <HStack>
          <Button size="sm" colorScheme="purple" onClick={() => { /* open main site */ window.open("/", "_blank"); }}>Open store</Button>
          <Button size="sm" colorScheme="red" onClick={() => { signOut(auth); }}>Logout</Button>
        </HStack>
      </Flex>

      {loadingData ? <Spinner /> : (
        <Stack spacing={6}>
          <Flex gap={6} direction={["column","row"]}>
            {/* Left: Product form + Settings */}
            <VStack align="stretch" flex="1" spacing={4}>
              <Box p={4} border="1px solid #eee" borderRadius="md">
                <Text fontWeight="700" mb={2}>{editing ? "Edit product" : "Add new product"}</Text>
                <form onSubmit={handleAddOrUpdateProduct}>
                  <Input placeholder="Name" mb={2} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  <Input placeholder="Price (numbers)" mb={2} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                  <Input placeholder="Original cost (admin only)" mb={2} value={form.originalCost} onChange={e => setForm(f => ({ ...f, originalCost: e.target.value }))} />
                  <Textarea placeholder="Description" mb={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  <Input placeholder="Stock" mb={2} value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                  <Textarea placeholder="Colors (one per line)" mb={2} value={form.colorsText} onChange={e => setForm(f => ({ ...f, colorsText: e.target.value }))} />
                  <Textarea placeholder="Sizes (one per line)" mb={2} value={form.sizesText} onChange={e => setForm(f => ({ ...f, sizesText: e.target.value }))} />
                  <FormControl mb={2}>
                    <FormLabel>Collections</FormLabel>
                    <Select multiple value={form.selectedCollections} onChange={(e) => {
                      const opts = Array.from(e.target.selectedOptions).map(o => o.value);
                      setForm(f => ({ ...f, selectedCollections: opts }));
                    }}>
                      {collections.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </Select>
                  </FormControl>

                  <FormControl mb={3}>
                    <FormLabel>Images (photo / camera / files)</FormLabel>
                    <Input type="file" multiple accept="image/*" ref={imagesInputRef} onChange={handleFilesChange} />
                    <HStack mt={3} spacing={2} wrap="wrap">
                      {(form.imagesPreview || []).map((u, i) => (
                        <Box key={i} border="1px solid #eee" p={1} borderRadius="md">
                          <Image src={u} boxSize="80px" objectFit="cover" />
                        </Box>
                      ))}
                    </HStack>
                  </FormControl>

                  <HStack>
                    <Button type="submit" colorScheme="purple">{editing ? "Update" : "Add product"}</Button>
                    {editing && <Button onClick={() => setEditing(null)}>Cancel</Button>}
                  </HStack>
                </form>
              </Box>

              <Box p={4} border="1px solid #eee" borderRadius="md">
                <Text fontWeight="700" mb={2}>Store settings</Text>
                <Input placeholder="Store name" mb={2} value={settingsDraft?.storeName || ""} onChange={e => setSettingsDraft(s => ({ ...s, storeName: e.target.value }))} />
                <Input placeholder="Tagline" mb={2} value={settingsDraft?.tagline || ""} onChange={e => setSettingsDraft(s => ({ ...s, tagline: e.target.value }))} />
                <FormControl mb={2}>
                  <FormLabel>Logo</FormLabel>
                  <Input type="file" accept="image/*" onChange={uploadLogoAndSave} ref={logoInputRef} />
                  {settingsDraft?.logoUrl && <Image src={settingsDraft.logoUrl} boxSize="80px" mt={2} objectFit="cover" />}
                </FormControl>

                <Input placeholder="Contact email" mb={2} value={settingsDraft?.contactEmail || ""} onChange={e => setSettingsDraft(s => ({ ...s, contactEmail: e.target.value }))} />
                <Input placeholder="WhatsApp number (e.g. 2348012345678)" mb={2} value={settingsDraft?.whatsapp || ""} onChange={e => setSettingsDraft(s => ({ ...s, whatsapp: e.target.value }))} />

                <Box mt={2}>
                  <Text fontWeight="600">Bank details (visible to customers)</Text>
                  <Input placeholder="Account name" mb={2} value={settingsDraft?.bank?.accountName || ""} onChange={e => setSettingsDraft(s => ({ ...s, bank: { ...(s.bank||{}), accountName: e.target.value } }))} />
                  <Input placeholder="Account number" mb={2} value={settingsDraft?.bank?.accountNumber || ""} onChange={e => setSettingsDraft(s => ({ ...s, bank: { ...(s.bank||{}), accountNumber: e.target.value } }))} />
                  <Input placeholder="Bank name" mb={2} value={settingsDraft?.bank?.bankName || ""} onChange={e => setSettingsDraft(s => ({ ...s, bank: { ...(s.bank||{}), bankName: e.target.value } }))} />
                </Box>

                <Box mt={3}>
                  <Text fontWeight="600">Announcement</Text>
                  <Textarea value={settingsDraft?.announcement || ""} onChange={e => setSettingsDraft(s => ({ ...s, announcement: e.target.value }))} />
                </Box>

                <Box mt={3}>
                  <HStack justify="space-between">
                    <Text fontWeight="600">Shipping zones</Text>
                    <Button size="sm" onClick={addShippingBlock}>Add zone</Button>
                  </HStack>
                  <VStack mt={2} align="stretch">
                    {(settingsDraft?.shippingBlocks || []).map((b, i) => (
                      <Box key={b.id} border="1px dashed #eee" p={2} borderRadius="md">
                        <Input placeholder="Title (e.g. Lagos Island)" mb={2} value={b.title} onChange={e => updateShippingBlock(i, "title", e.target.value)} />
                        <Input placeholder="Fee (numbers)" mb={2} value={String(b.fee || 0)} onChange={e => updateShippingBlock(i, "fee", e.target.value)} />
                        <Textarea placeholder="Description" mb={2} value={b.desc || ""} onChange={e => updateShippingBlock(i, "desc", e.target.value)} />
                        <Button size="sm" colorScheme="red" onClick={() => removeShippingBlock(i)}>Remove</Button>
                      </Box>
                    ))}
                  </VStack>
                </Box>

                <HStack mt={3}>
                  <Button colorScheme="green" onClick={saveSettings}>Save settings</Button>
                </HStack>
              </Box>
            </VStack>

            {/* Right: Products list + Collections + Orders */}
            <VStack align="stretch" flex="2" spacing={4}>
              <Box p={4} border="1px solid #eee" borderRadius="md">
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontWeight="700">Products</Text>
                  <Button size="sm" onClick={createCollection}>Create collection</Button>
                </Flex>

                <VStack align="stretch" spacing={3}>
                  {products.map(p => (
                    <Flex key={p.id} p={3} border="1px solid #eee" borderRadius="md" align="center" justify="space-between" wrap="wrap">
                      <Flex align="center" gap={3}>
                        <Image src={(p.images && p.images[0]) || "https://via.placeholder.com/80"} boxSize="80px" objectFit="cover" borderRadius="md" />
                        <Box>
                          <Text fontWeight="700">{p.name}</Text>
                          <Text color="gray.600">₦{Number(p.price||0).toLocaleString()}</Text>
                          <Text fontSize="sm" color="gray.500">Original cost: ₦{Number(p.originalCost||0).toLocaleString()}</Text>
                          <Text fontSize="sm" color={p.stock>0 ? "green.600" : "red.500"}>{p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</Text>
                          <HStack mt={2} spacing={2}>
                            {(p.collections || []).map(cn => <Tag key={cn}>{cn}</Tag>)}
                          </HStack>
                        </Box>
                      </Flex>

                      <HStack>
                        <Button size="sm" onClick={() => startEditProduct(p)}>Edit</Button>
                        <Button size="sm" colorScheme="red" onClick={() => handleDeleteProduct(p)}>Delete</Button>
                        <Button size="sm" onClick={() => openAssignModal(p)}>Assign collections</Button>
                      </HStack>
                    </Flex>
                  ))}
                </VStack>
              </Box>

              <Box p={4} border="1px solid #eee" borderRadius="md">
                <Text fontWeight="700" mb={3}>Orders</Text>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Order ID</Th>
                      <Th>Customer</Th>
                      <Th>Total</Th>
                      <Th>Status</Th>
                      <Th>When</Th>
                      <Th>Action</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {orders.map(o => (
                      <Tr key={o.id}>
                        <Td><Badge>{o.orderId || o.id}</Badge></Td>
                        <Td>{o.customer?.name || "—"}<br/><Text fontSize="sm" color="gray.500">{o.customer?.phone || o.customer?.email || ""}</Text></Td>
                        <Td>₦{Number(o.total||0).toLocaleString()}</Td>
                        <Td>{o.status}</Td>
                        <Td>{o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toLocaleString() : ""}</Td>
                        <Td>
                          <Button size="xs" onClick={() => openOrder(o)}>View</Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </VStack>
          </Flex>

          {/* Assign collections modal */}
          <Modal isOpen={assignModalOpen} onClose={() => setAssignModalOpen(false)}>
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Assign collections</ModalHeader>
              <ModalBody>
                <VStack align="stretch">
                  {collections.map(c => (
                    <HStack key={c.id} justify="space-between">
                      <Text>{c.name}</Text>
                      <input type="checkbox" checked={(assignSelected || []).includes(c.name)} onChange={(e) => {
                        const checked = e.target.checked;
                        setAssignSelected(prev => {
                          if (checked) return [...(prev||[]), c.name];
                          return (prev||[]).filter(x => x !== c.name);
                        });
                      }} />
                    </HStack>
                  ))}
                </VStack>
              </ModalBody>
              <ModalFooter>
                <Button mr={3} onClick={() => { setAssignModalOpen(false); }}>Cancel</Button>
                <Button colorScheme="purple" onClick={saveAssignCollections}>Save</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          {/* Order view modal */}
          <Modal isOpen={!!orderView} onClose={() => setOrderView(null)} size="lg">
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Order #{orderView?.orderId}</ModalHeader>
              <ModalBody>
                {orderView ? (
                  <VStack align="stretch" spacing={3}>
                    <Box>
                      <Text fontWeight="700">Customer</Text>
                      <Text>{orderView.customer?.name}</Text>
                      <Text fontSize="sm" color="gray.500">{orderView.customer?.email} • {orderView.customer?.phone}</Text>
                      <Text mt={2}><strong>Address:</strong> {(orderView.address?.line || "")} {(orderView.address?.city ? ", " + orderView.address.city : "")} {(orderView.address?.state ? ", " + orderView.address.state : "")}</Text>
                    </Box>

                    <Box>
                      <Text fontWeight="700">Items</Text>
                      <VStack align="stretch">
                        {(orderView.items || []).map((it, i) => (
                          <Flex key={i} gap={3} align="center">
                            <Image src={it.image || (it.images && it.images[0]) || "https://via.placeholder.com/80"} boxSize="64px" objectFit="cover" />
                            <Box>
                              <Text fontWeight="600">{it.name}</Text>
                              <Text fontSize="sm">{it.qty} × ₦{Number(it.price||0).toLocaleString()}</Text>
                              {it.color && <Text fontSize="sm">Color: {it.color}</Text>}
                              {it.size && <Text fontSize="sm">Size: {it.size}</Text>}
                            </Box>
                          </Flex>
                        ))}
                      </VStack>
                      <Divider my={2} />
                      <Box>
                        <Text>Subtotal: ₦{Number(orderView.subtotal||0).toLocaleString()}</Text>
                        <Text>Shipping: ₦{Number(orderView.shipping?.fee||0).toLocaleString()}</Text>
                        <Text fontWeight="700">Total: ₦{Number(orderView.total||0).toLocaleString()}</Text>
                        <Text mt={2}><strong>Status:</strong> {orderView.status}</Text>
                      </Box>
                      <Box mt={2}>
                        {orderView.paymentProof && <Box><Text fontWeight="600">Payment proof:</Text><Image src={orderView.paymentProof} boxSize="180px" objectFit="cover" /></Box>}
                      </Box>
                    </Box>

                    <Box>
                      <Text fontWeight="700">Gains</Text>
                      {(() => {
                        const { totalCost, totalSales, gain } = computeOrderGains(orderView);
                        return <Box><Text>Cost: ₦{Number(totalCost).toLocaleString()}</Text><Text>Sales: ₦{Number(totalSales).toLocaleString()}</Text><Text fontWeight="700">Gain: ₦{Number(gain).toLocaleString()}</Text></Box>;
                      })()}
                    </Box>
                  </VStack>
                ) : null}
              </ModalBody>
              <ModalFooter>
                <Select placeholder="Update status" mr={3} onChange={(e) => updateOrderStatus(orderView, e.target.value)}>
                  <option value="Awaiting Confirmation">Awaiting Confirmation</option>
                  <option value="Processing">Processing</option>
                  <option value="Out for delivery">Out for delivery</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Pending Delivery Fee">Pending Delivery Fee</option>
                  <option value="Stockpile">Stockpile</option>
                </Select>
                <Button onClick={() => setOrderView(null)}>Close</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </Stack>
      )}
    </Box>
  );
}
