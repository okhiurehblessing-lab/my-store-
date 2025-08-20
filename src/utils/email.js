// src/utils/email.js
import emailjs from "emailjs-com";

const SERVICE_ID = "service_opcf6cl";
const TEMPLATE_CUSTOMER = "template_4zrsdni";
const TEMPLATE_ADMIN = "template_zc87bdl";
const PUBLIC_KEY = "RN5H1CcY7Fqkakg5w";

emailjs.init(PUBLIC_KEY);

export async function sendCustomerOrderEmail(vars) {
  return emailjs.send(SERVICE_ID, TEMPLATE_CUSTOMER, vars);
}
export async function sendAdminOrderEmail(vars) {
  return emailjs.send(SERVICE_ID, TEMPLATE_ADMIN, vars);
}
