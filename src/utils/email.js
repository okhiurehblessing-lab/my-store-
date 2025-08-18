// src/utils/email.js
import emailjs from "emailjs-com";

export const EMAIL_PUBLIC_KEY = "RN5H1CcY7Fqkakg5w";
export const EMAIL_SERVICE_ID = "service_opcf6cl";
export const TEMPLATE_ADMIN = "template_4zrsdni";
export const TEMPLATE_CUSTOMER = "template_zc87bdl";

emailjs.init(EMAIL_PUBLIC_KEY);

export async function sendAdminOrderEmail(payload){
  return emailjs.send(EMAIL_SERVICE_ID, TEMPLATE_ADMIN, payload);
}
export async function sendCustomerOrderEmail(payload){
  return emailjs.send(EMAIL_SERVICE_ID, TEMPLATE_CUSTOMER, payload);
}
