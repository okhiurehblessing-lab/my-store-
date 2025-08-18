// src/components/AdminPanel.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  Layout, Menu, Button, Upload, Input, Form, InputNumber, Table,
  Select, Modal, Tag, message, Space, Popconfirm, Switch, Divider, Typography
} from "antd";
import { UploadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import { db } from "../firebase";
import {
  collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp, getDoc
} from "firebase/firestore";
import { sendAdminOrderEmail } from "../utils/email";

const { Sider, Content, Header } = Layout;
const { Option } = Select;
const { Title, Paragraph } = Typography;

/**
 * AdminPanel.jsx
 * - Manage products (add/edit/delete)
 * - Manage collections
 * - Manage shipping blocks & fees
 * - Manage orders (view, change status)
 * - Manage store settings (store name, contact email, whatsapp, bank details, announcement, logo upload)
 *
 * Notes:
 * - Uses an unsigned Cloudinary preset (CLOUD_NAME, UPLOAD_PRESET below). Update if you changed presets.
 * - Firestore documents:
 *   - collection "products"
 *   - collection "collections"
 *   - collection "orders"
 *   - doc "settings/store"
 */

// Cloudinary unsigned upload config (update if you changed them)
const CLOUD_NAME = "desbqctik";
const UPLOAD_PRESET = "myshop_preset";

/* upload helper (unsigned) */
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: fd
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error("Cloudinary upload failed");
  return data.secure_url;
}

export default function AdminPanel() {
  // UI selection
  const [selected, setSelected] = useState("dashboard");

  // Data
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({ shippingBlocks: [], bank: {} });

  // Products form / edit
  const [productForm] = Form.useForm();
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const uploadRef = useRef(null);

  // Collections
  const [newCollectionName, setNewCollectionName] = useState("");

  // Shipping block inputs
  const [shipTitle, setShipTitle] = useState("");
  const [shipFee, setShipFee] = useState(0);
  const [shipDesc, setShipDesc] = useState("");

  // Settings form
  const [settingsForm] = Form.useForm();
  const logoUploadRef = useRef(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Orders modal
  const [orderViewVisible, setOrderViewVisible] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);

  // Realtime listeners
  useEffect(() => {
    const prodQ = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubP = onSnapshot(prodQ, snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const colQ = query(collection(db, "collections"), orderBy("name", "asc"));
    const unsubC = onSnapshot(colQ, snap => setCollections(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const ordersQ = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubO = onSnapshot(ordersQ, snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const settingsRef = doc(db, "settings", "store");
    const unsubS = onSnapshot(settingsRef, snap => { if (snap.exists()) setSettings(snap.data()); });

    return () => {
      unsubP(); unsubC(); unsubO(); unsubS();
    };
  }, []);

  /* ----------------- PRODUCTS ----------------- */

  function openAddProduct() {
    setEditingProduct(null);
    productForm.resetFields();
    setProductModalVisible(true);
  }

  async function openEditProduct(p) {
    setEditingProduct(p);
    // convert arrays to comma strings for input fields (colors/sizes)
    productForm.setFieldsValue({
      name: p.name,
      price: p.price,
      originalCost: p.originalCost,
      stock: p.stock,
      description: p.description,
      collection: p.collection,
      colors: (p.colors || []).join(", "),
      sizes: (p.sizes || []).join(", "),
      images: null
    });
    setProductModalVisible(true);
  }

  async function handleSaveProduct(values) {
    try {
      // images may be selected via Upload component; value is an Upload file object
      let imageUrls = editingProduct ? (editingProduct.images || []) : [];

      const uploadedFiles = (values.images && values.images.fileList) || [];
      if (uploadedFiles.length) {
        // upload each file to Cloudinary
        for (const f of uploadedFiles) {
          const url = await uploadToCloudinary(f.originFileObj);
          imageUrls.push(url);
        }
      }

      const payload = {
        name: values.name,
        price: Number(values.price || 0),
        originalCost: Number(values.originalCost || 0),
        stock: Number(values.stock || 0),
        description: values.description || "",
        collection: values.collection || "",
        colors: (values.colors || "").split(",").map(s => s.trim()).filter(Boolean),
        sizes: (values.sizes || "").split(",").map(s => s.trim()).filter(Boolean),
        images: imageUrls,
        updatedAt: serverTimestamp()
      };

      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), payload);
        message.success("Product updated");
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "products"), payload);
        message.success("Product created");
      }

      setProductModalVisible(false);
      productForm.resetFields();
      setEditingProduct(null);
    } catch (err) {
      console.error(err);
      message.error("Failed to save product");
    }
  }

  async function handleDeleteProduct(p) {
    try {
      await deleteDoc(doc(db, "products", p.id));
      message.success("Product deleted");
    } catch (err) {
      console.error(err);
      message.error("Delete failed");
    }
  }

  /* ----------------- COLLECTIONS ----------------- */

  async function handleAddCollection() {
    if (!newCollectionName || !newCollectionName.trim()) return message.warn("Collection name required");
    try {
      await addDoc(collection(db, "collections"), { name: newCollectionName.trim() });
      setNewCollectionName("");
      message.success("Collection added");
    } catch (err) {
      console.error(err);
      message.error("Failed to add collection");
    }
  }

  async function handleDeleteCollection(colId) {
    try {
      await deleteDoc(doc(db, "collections", colId));
      message.success("Collection removed");
    } catch (err) {
      console.error(err);
      message.error("Delete failed");
    }
  }

  /* ----------------- SHIPPING ----------------- */

  async function handleAddShippingBlock() {
    if (!shipTitle) return message.warn("Title required");
    try {
      const settingsRef = doc(db, "settings", "store");
      // read current blocks, append
      const snap = await getDoc(settingsRef);
      const cur = snap.exists() ? (snap.data().shippingBlocks || []) : [];
      const id = "sb_" + Math.random().toString(36).slice(2, 8);
      const blocks = [...cur, { id, title: shipTitle, fee: Number(shipFee || 0), desc: shipDesc }];
      await updateDoc(settingsRef, { shippingBlocks: blocks, updatedAt: serverTimestamp() });
      setShipTitle(""); setShipFee(0); setShipDesc("");
      message.success("Shipping block saved");
    } catch (err) {
      console.error(err);
      message.error("Failed to save shipping block");
    }
  }

  async function handleDeleteShippingBlock(id) {
    try {
      const settingsRef = doc(db, "settings", "store");
      const snap = await getDoc(settingsRef);
      const cur = snap.exists() ? (snap.data().shippingBlocks || []) : [];
      const blocks = cur.filter(b => b.id !== id);
      await updateDoc(settingsRef, { shippingBlocks: blocks, updatedAt: serverTimestamp() });
      message.success("Deleted");
    } catch (err) {
      console.error(err);
      message.error("Failed");
    }
  }

  /* ----------------- ORDERS ----------------- */

  function openOrder(order) {
    setActiveOrder(order);
    setOrderViewVisible(true);
  }

  async function updateOrderStatus(orderId, newStatus) {
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus, updatedAt: serverTimestamp() });
      message.success("Order updated");
    } catch (err) {
      console.error(err);
      message.error("Failed to update order");
    }
  }

  /* ----------------- SETTINGS ----------------- */

  async function handleSaveSettings(values) {
    try {
      const settingsRef = doc(db, "settings", "store");
      const payload = {
        storeName: values.storeName || "",
        tagline: values.tagline || "",
        contactEmail: values.contactEmail || "",
        whatsapp: values.whatsapp || "",
        bank: { accountName: values.accountName || "", accountNumber: values.accountNumber || "", bankName: values.bankName || "" },
        announcement: values.announcement || settings.announcement || "",
        allowPickup: !!values.allowPickup,
        allowAddressNotThere: !!values.allowAddressNotThere,
        updatedAt: serverTimestamp()
      };
      await updateDoc(settingsRef, payload);
      message.success("Settings saved");
    } catch (err) {
      console.error(err);
      message.error("Failed to save settings");
    }
  }

  async function handleUploadLogo(fileObj) {
    try {
      setLogoUploading(true);
      const url = await uploadToCloudinary(fileObj);
      const settingsRef = doc(db, "settings", "store");
      await updateDoc(settingsRef, { logoUrl: url, updatedAt: serverTimestamp() });
      message.success("Logo updated");
    } catch (err) {
      console.error(err);
      message.error("Logo upload failed");
    } finally {
      setLogoUploading(false);
    }
  }

  /* ----------------- TABLES & COLUMNS ----------------- */

  const productColumns = [
    {
      title: "Image",
      dataIndex: "images",
      render: (imgs) => <img src={(imgs && imgs[0]) || "/assets/placeholder.jpg"} alt="p" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
    },
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Price", dataIndex: "price", render: v => `₦${Number(v || 0).toLocaleString()}` },
    { title: "Stock", dataIndex: "stock" },
    {
      title: "Actions",
      render: (_r, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEditProduct(record)}>Edit</Button>
          <Popconfirm title="Delete product?" onConfirm={() => handleDeleteProduct(record)}>
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const orderColumns = [
    { title: "OrderID", dataIndex: "orderId", key: "orderId" },
    { title: "Customer", render: r => r.customer?.name || "—" },
    { title: "Total", render: r => `₦${Number(r.total || 0).toLocaleString()}` },
    { title: "Status", dataIndex: "status" },
    {
      title: "Actions", render: (_r, rec) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => openOrder(rec)}>View</Button>
          <Select defaultValue={rec.status} style={{ width: 160 }} onChange={(val) => updateOrderStatus(rec.id, val)}>
            <Option value="Awaiting Confirmation">Awaiting Confirmation</Option>
            <Option value="Processing">Processing</Option>
            <Option value="Shipped">Shipped</Option>
            <Option value="Delivered">Delivered</Option>
            <Option value="Cancelled">Cancelled</Option>
            <Option value="Stockpile">Stockpile</Option>
            <Option value="Pending Delivery Fee">Pending Delivery Fee</Option>
          </Select>
        </Space>
      )
    }
  ];

  /* ----------------- RENDER ----------------- */

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={240}>
        <div style={{ padding: 18, color: "#fff", fontWeight: 800, fontSize: 16 }}>
          {settings.storeName || "Essyessentials"} Admin
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[selected]} onClick={(e) => setSelected(e.key)}>
          <Menu.Item key="dashboard">Dashboard</Menu.Item>
          <Menu.Item key="products">Products</Menu.Item>
          <Menu.Item key="collections">Collections</Menu.Item>
          <Menu.Item key="shipping">Shipping</Menu.Item>
          <Menu.Item key="orders">Orders</Menu.Item>
          <Menu.Item key="settings">Settings</Menu.Item>
        </Menu>
      </Sider>

      <Layout>
        <Header style={{ background: "#fff", padding: "12px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>{selected.toUpperCase()}</div>
            <div>Admin</div>
          </div>
        </Header>

        <Content style={{ padding: 20 }}>
          {selected === "dashboard" && (
            <div>
              <Title level={3}>Dashboard</Title>
              <Paragraph>Products: {products.length} • Collections: {collections.length} • Orders: {orders.length}</Paragraph>
              <Divider />
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, padding: 16, border: "1px solid #eee", borderRadius: 8 }}>
                  <Title level={5}>Quick actions</Title>
                  <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setSelected("products"); openAddProduct(); }}>Add product</Button>
                    <Button onClick={() => setSelected("orders")}>View orders</Button>
                  </Space>
                </div>
                <div style={{ flex: 2, padding: 16, border: "1px solid #eee", borderRadius: 8 }}>
                  <Title level={5}>Recent orders</Title>
                  <Table columns={orderColumns} dataSource={orders.slice(0, 6)} rowKey="id" pagination={false} />
                </div>
              </div>
            </div>
          )}

          {selected === "products" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <Title level={4}>Products</Title>
                <Space>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openAddProduct}>Add product</Button>
                </Space>
              </div>

              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <Form form={productForm} layout="vertical" onFinish={handleSaveProduct}>
                    <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                      <Input placeholder="Product name" />
                    </Form.Item>

                    <Form.Item name="price" label="Price (₦)" rules={[{ required: true }]}>
                      <InputNumber style={{ width: "100%" }} />
                    </Form.Item>

                    <Form.Item name="originalCost" label="Original Cost (admin only)">
                      <InputNumber style={{ width: "100%" }} />
                    </Form.Item>

                    <Form.Item name="stock" label="Stock" initialValue={0}>
                      <InputNumber style={{ width: "100%" }} min={0} />
                    </Form.Item>

                    <Form.Item name="collection" label="Collection">
                      <Select allowClear>
                        {collections.map(c => <Option value={c.name} key={c.id}>{c.name}</Option>)}
                      </Select>
                    </Form.Item>

                    <Form.Item name="colors" label="Colors (comma separated)">
                      <Input placeholder="e.g. red, blue, green" />
                    </Form.Item>

                    <Form.Item name="sizes" label="Sizes (comma separated)">
                      <Input placeholder="e.g. S, M, L" />
                    </Form.Item>

                    <Form.Item name="description" label="Description">
                      <Input.TextArea rows={4} />
                    </Form.Item>

                    <Form.Item name="images" label="Images">
                      <Upload beforeUpload={() => false} multiple listType="picture" ref={uploadRef}>
                        <Button icon={<UploadOutlined />}>Select images</Button>
                      </Upload>
                    </Form.Item>

                    <Form.Item>
                      <Space>
                        <Button type="primary" htmlType="submit">Save</Button>
                        <Button onClick={() => { productForm.resetFields(); setEditingProduct(null); }}>Reset</Button>
                      </Space>
                    </Form.Item>
                  </Form>
                </div>

                <div style={{ width: 720 }}>
                  <Table dataSource={products} columns={productColumns} rowKey="id" pagination={{ pageSize: 6 }} />
                </div>
              </div>

              {/* Product modal for editing is the same form; we just reuse the form fields */}
              <Modal visible={productModalVisible} onCancel={() => { setProductModalVisible(false); setEditingProduct(null); }} footer={null} title={editingProduct ? "Edit product" : "Add product"}>
                {/* The same form is used above; showing a note */}
                <Paragraph>Use the form on the left to add or edit product. To attach images for editing, select image files; existing images will be preserved unless replaced.</Paragraph>
                <div style={{ textAlign: "right" }}>
                  <Button onClick={() => setProductModalVisible(false)}>Close</Button>
                </div>
              </Modal>
            </div>
          )}

          {selected === "collections" && (
            <div>
              <Title level={4}>Collections</Title>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <Input placeholder="New collection name" value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} style={{ width: 320 }} />
                <Button type="primary" onClick={handleAddCollection}>Add collection</Button>
              </div>
              <div>
                {collections.map(c => (
                  <Tag key={c.id} style={{ marginBottom: 8 }}>
                    {c.name}
                    <Popconfirm title="Delete collection?" onConfirm={() => handleDeleteCollection(c.id)}>
                      <DeleteOutlined style={{ marginLeft: 8 }} />
                    </Popconfirm>
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {selected === "shipping" && (
            <div>
              <Title level={4}>Shipping blocks & fees</Title>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <Input placeholder="Title (e.g. Lagos Island)" value={shipTitle} onChange={(e) => setShipTitle(e.target.value)} style={{ width: 320 }} />
                <InputNumber placeholder="Fee" value={shipFee} onChange={(v) => setShipFee(v)} style={{ width: 140 }} />
                <Input placeholder="Description" value={shipDesc} onChange={(e) => setShipDesc(e.target.value)} style={{ width: 400 }} />
                <Button type="primary" onClick={handleAddShippingBlock}>Add</Button>
              </div>

              <div>
                {(settings.shippingBlocks || []).map(sb => (
                  <Tag key={sb.id} style={{ marginBottom: 8 }}>
                    {sb.title} • ₦{Number(sb.fee || 0).toLocaleString()}
                    <Popconfirm title="Delete shipping block?" onConfirm={() => handleDeleteShippingBlock(sb.id)}>
                      <DeleteOutlined style={{ marginLeft: 8 }} />
                    </Popconfirm>
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {selected === "orders" && (
            <div>
              <Title level={4}>Orders</Title>
              <Table dataSource={orders} columns={orderColumns} rowKey="id" pagination={{ pageSize: 8 }} />
            </div>
          )}

          {selected === "settings" && (
            <div style={{ maxWidth: 900 }}>
              <Title level={4}>Store settings</Title>
              <Form layout="vertical" initialValues={{
                storeName: settings.storeName,
                tagline: settings.tagline,
                contactEmail: settings.contactEmail,
                whatsapp: settings.whatsapp,
                accountName: settings.bank?.accountName,
                accountNumber: settings.bank?.accountNumber,
                bankName: settings.bank?.bankName,
                announcement: settings.announcement,
                allowPickup: settings.allowPickup,
                allowAddressNotThere: settings.allowAddressNotThere
              }} form={settingsForm} onFinish={handleSaveSettings}>
                <Form.Item name="storeName" label="Store name"><Input /></Form.Item>
                <Form.Item name="tagline" label="Tagline"><Input /></Form.Item>
                <Form.Item name="contactEmail" label="Contact email"><Input /></Form.Item>
                <Form.Item name="whatsapp" label="WhatsApp number"><Input placeholder="countrycode + number (e.g. 2348012345678)" /></Form.Item>

                <Divider />
                <Title level={5}>Bank details (visible to customers at checkout)</Title>
                <Form.Item name="accountName" label="Account name"><Input /></Form.Item>
                <Form.Item name="accountNumber" label="Account number"><Input /></Form.Item>
                <Form.Item name="bankName" label="Bank name"><Input /></Form.Item>

                <Divider />
                <Form.Item name="announcement" label="Announcement (top bar)"><Input.TextArea rows={3} /></Form.Item>

                <Form.Item name="allowPickup" label="Allow pickup" valuePropName="checked"><Switch /></Form.Item>
                <Form.Item name="allowAddressNotThere" label="Allow 'Address not listed' option" valuePropName="checked"><Switch /></Form.Item>

                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">Save settings</Button>
                  </Space>
                </Form.Item>
              </Form>

              <Divider />

              <Title level={5}>Upload logo</Title>
              <Upload beforeUpload={(file) => { handleUploadLogo(file); return false; }} showUploadList={false}>
                <Button loading={logoUploading} icon={<UploadOutlined />}>Select logo and upload</Button>
              </Upload>

              <div style={{ marginTop: 16 }}>
                <Paragraph><strong>Current logo:</strong></Paragraph>
                {settings.logoUrl ? <img src={settings.logoUrl} alt="logo" style={{ height: 80, objectFit: "contain" }} /> : <div>No logo</div>}
              </div>
            </div>
          )}
        </Content>
      </Layout>

      {/* Order view modal */}
      <Modal visible={orderViewVisible} onCancel={() => setOrderViewVisible(false)} footer={null} width={700} title={`Order ${activeOrder?.orderId || ""}`}>
        {activeOrder ? (
          <div>
            <p><strong>Customer:</strong> {activeOrder.customer?.name} • {activeOrder.customer?.phone} • {activeOrder.customer?.email}</p>
            <p><strong>Address:</strong> {activeOrder.address || "—"}</p>
            <p><strong>Status:</strong> {activeOrder.status}</p>
            <Divider />
            <Title level={5}>Items</Title>
            {activeOrder.items?.map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                <img src={it.image || "/assets/placeholder.jpg"} alt="it" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                <div>
                  <div>{it.name}</div>
                  <div>Qty: {it.qty} • ₦{Number(it.price || 0).toLocaleString()}</div>
                </div>
              </div>
            ))}
            <Divider />
            <p><strong>Subtotal:</strong> ₦{Number(activeOrder.subtotal || 0).toLocaleString()}</p>
            <p><strong>Shipping:</strong> ₦{Number(activeOrder.shipping?.fee || 0).toLocaleString()}</p>
            <p><strong>Total:</strong> ₦{Number(activeOrder.total || 0).toLocaleString()}</p>

            {activeOrder.paymentProof && (<div>
              <Divider />
              <p><strong>Payment proof:</strong></p>
              <img src={activeOrder.paymentProof} alt="proof" style={{ width: "100%", maxHeight: 300, objectFit: "contain" }} />
            </div>)}

            <div style={{ marginTop: 12 }}>
              <Space>
                <Button type="primary" onClick={() => updateOrderStatus(activeOrder.id, "Processing")}>Mark processing</Button>
                <Button onClick={() => updateOrderStatus(activeOrder.id, "Shipped")}>Mark shipped</Button>
                <Button danger onClick={() => updateOrderStatus(activeOrder.id, "Cancelled")}>Cancel</Button>
              </Space>
            </div>
          </div>
        ) : <div>Loading...</div>}
      </Modal>
    </Layout>
  );
}
