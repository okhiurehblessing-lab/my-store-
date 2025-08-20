// src/pages/Checkout.jsx
import React, { useMemo, useRef, useState } from "react";
import { Box, Button, Divider, Flex, Image, Input, Radio, RadioGroup, Stack, Text, Textarea, useToast } from "@chakra-ui/react";
import useCart from "../hooks/useCart";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { db } from "../firebase";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { sendAdminOrderEmail, sendCustomerOrderEmail } from "../utils/email";

const money = (n) => "₦" + Number(n || 0).toLocaleString();

export default function Checkout(){
  const { cart, inc, dec, remove, clear, subtotal } = useCart();
  const { settings } = useSettings();
  const toast = useToast();
  const nav = useNavigate();

  const [customer, setCustomer] = useState({ name:"", email:"", phone:"" });
  const [address, setAddress] = useState({ line:"", city:"", state:"" });
  const [shipping, setShipping] = useState(null);
  const [loading, setLoading] = useState(false);

  const shippingOptions = useMemo(()=>{
    const blocks = settings.shippingBlocks || [];
    const opts = [...blocks.map(b=>({ id:b.id||b.title, title:b.title, fee:Number(b.fee||0), desc:b.desc||"" }))];
    if (settings.allowPickup) opts.unshift({ id:"pickup", title:"Pickup", fee:0, desc:"Pickup from store" });
    if (settings.allowAddressNotThere) opts.push({ id:"address-not-listed", title:"Address not listed", fee:0, desc:"Admin will confirm delivery fee" });
    opts.push({ id:"stockpile", title:"Stockpile (reserve)", fee:0, desc:"Reserve items and pay later" });
    return opts;
  }, [settings]);

  const shippingObj = useMemo(()=> shippingOptions.find(s=> s.id===shipping) || { fee:0, title:"" }, [shippingOptions, shipping]);
  const total = subtotal + Number(shippingObj.fee||0);

  async function placeOrder() {
    if (cart.length===0) { toast({title:"Cart is empty", status:"error"}); return; }
    if (!customer.name || !customer.email || !customer.phone) { toast({title:"Fill name, email, phone", status:"error"}); return; }
    if (!shipping) { toast({title:"Choose shipping", status:"error"}); return; }

    setLoading(true);
    try {
      const orderId = Date.now() + Math.floor(Math.random()*1000);
      const orderDoc = {
        orderId,
        items: cart,
        subtotal,
        shipping: shippingObj,
        total,
        customer,
        address,
        paymentProof: null,
        status: (shipping==="stockpile" ? "Stockpile" : (shipping==="address-not-listed" ? "Pending Delivery Fee" : "Awaiting Confirmation")),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "orders"), orderDoc);

      if (shipping !== "stockpile") {
        for (const it of cart) {
          try {
            const pRef = doc(db, "products", it.id);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
              const cur = pSnap.data().stock || 0;
              await updateDoc(pRef, { stock: Math.max(0, cur - (it.qty||0)) });
            }
          } catch {}
        }
      }

      const itemsText = cart.map(i=> `${i.name} x${i.qty} @ ${money(i.price)}`).join("\n");
      const payload = {
        customer_name: customer.name,
        order_id: String(orderId),
        order_items: itemsText,
        total_amount: money(total),
        delivery_address: [address.line,address.city,address.state].filter(Boolean).join(", "),
        shipping_method: shippingObj.title || ""
      };
      try { await sendCustomerOrderEmail(payload); await sendAdminOrderEmail(payload); } catch(e){}

      if (settings.whatsapp) {
        const msg = encodeURIComponent(
          `New Order (#${orderId})\n\n` + itemsText + `\n\nTotal: ${money(total)}\n` +
          `Name: ${customer.name}\nPhone: ${customer.phone}\nAddress: ${[address.line,address.city,address.state].filter(Boolean).join(", ")}`
        );
        window.open(`https://wa.me/${settings.whatsapp}?text=${msg}`, "_blank");
      }

      clear();
      nav("/order-success");
    } catch (e) {
      toast({ title:"Order failed", status:"error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box maxW="1100px" mx="auto" px={4} py={6}>
      <Text fontWeight="800" fontSize="xl" mb={3}>Checkout</Text>

      {cart.length === 0 ? <Text>Your cart is empty.</Text> :
        cart.map((it, idx)=> (
          <Flex key={idx} align="center" gap={3} py={3} borderBottom="1px dashed #eee">
            <Image src={it.image} boxSize="64px" borderRadius="md" objectFit="cover"/>
            <Box flex="1">
              <Text>{it.name}</Text>
              <Text color="gray.500">₦{Number(it.price).toLocaleString()} • Qty: {it.qty}</Text>
              <Flex gap={2} mt={2}>
                <Button size="xs" onClick={()=> dec(idx)}>-</Button>
                <Button size="xs" onClick={()=> inc(idx)}>+</Button>
                <Button size="xs" onClick={()=> remove(idx)}>Remove</Button>
              </Flex>
            </Box>
          </Flex>
        ))
      }

      <Divider my={4}/>

      <Text fontWeight="700" mb={2}>Customer</Text>
      <Input placeholder="Full name" mb={2} value={customer.name} onChange={(e)=> setCustomer(s=>({ ...s, name:e.target.value }))}/>
      <Input placeholder="Email" mb={2} value={customer.email} onChange={(e)=> setCustomer(s=>({ ...s, email:e.target.value }))}/>
      <Input placeholder="Phone" mb={2} value={customer.phone} onChange={(e)=> setCustomer(s=>({ ...s, phone:e.target.value }))}/>

      <Text fontWeight="700" mt={4} mb={2}>Address</Text>
      <Textarea placeholder="Address line, city, state" mb={2}
        value={[address.line,address.city,address.state].filter(Boolean).join(", ")}
        onChange={(e)=>{
          const parts = e.target.value.split(",").map(p=>p.trim());
          setAddress({ line: parts[0]||"", city:parts[1]||"", state:parts[2]||"" });
        }}
      />

      <Text fontWeight="700" mt={4}>Shipping</Text>
      <RadioGroup value={shipping} onChange={setShipping}>
        <Stack mt={2}>
          {shippingOptions.map(s=>(
            <Radio key={s.id} value={s.id}>
              <Box>
                <Text fontWeight="600">{s.title} {s.fee ? `• ${money(s.fee)}` : ""}</Text>
                <Text fontSize="sm" color="gray.500">{s.desc}</Text>
              </Box>
            </Radio>
          ))}
        </Stack>
      </RadioGroup>

      <Box mt={4}>
        <Text fontWeight="700">Payment</Text>
        <Text><b>Account name:</b> {settings.bank?.accountName || "—"}</Text>
        <Text><b>Account number:</b> {settings.bank?.accountNumber || "—"}</Text>
        <Text><b>Bank:</b> {settings.bank?.bankName || "—"}</Text>
      </Box>

      <Divider my={4}/>
      <Flex justify="space-between" align="center">
        <Box>
          <Text>Subtotal: {money(subtotal)}</Text>
          <Text>Shipping: {money(shippingObj.fee || 0)}</Text>
          <Text fontWeight="800">Total: {money(total)}</Text>
        </Box>
        <Button colorScheme="purple" onClick={placeOrder} isLoading={loading} isDisabled={cart.length===0}>Place order</Button>
      </Flex>
    </Box>
  );
}
