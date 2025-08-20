import emailjs from "emailjs-com";

export const sendEmail = (formData) => {
  return emailjs.send(
    process.env.REACT_APP_EMAILJS_SERVICE_ID,
    process.env.REACT_APP_EMAILJS_TEMPLATE_ID,
    formData,
    process.env.REACT_APP_EMAILJS_PUBLIC_KEY
  );
};
