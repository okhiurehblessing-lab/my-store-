import emailjs from "@emailjs/browser";

export async function sendAdminOrderEmail(order) {
  return emailjs.send(
    process.env.REACT_APP_EMAILJS_SERVICE_ID,
    process.env.REACT_APP_EMAILJS_TEMPLATE_ID1, // admin template
    {
      customer_name: order.customerName,
      customer_email: order.customerEmail,
      order_id: order.id,
      total: order.total,
      items: order.items.map(i => `${i.name} x${i.quantity}`).join(", "),
    },
    process.env.REACT_APP_EMAILJS_PUBLIC_KEY
  );
}

export async function sendCustomerOrderEmail(order) {
  return emailjs.send(
    process.env.REACT_APP_EMAILJS_SERVICE_ID,
    process.env.REACT_APP_EMAILJS_TEMPLATE_ID2, // customer template
    {
      customer_name: order.customerName,
      order_id: order.id,
      total: order.total,
      items: order.items.map(i => `${i.name} x${i.quantity}`).join(", "),
    },
    process.env.REACT_APP_EMAILJS_PUBLIC_KEY
  );
}
