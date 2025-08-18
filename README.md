# Essyessentials — React + Chakra UI (store) + Ant Design (admin)

This repository is a React app built for the **Essyessentials** store.
It uses:
- **Chakra UI** for customer storefront UI
- **Ant Design** for admin dashboard
- **Firebase Firestore** for data (products, collections, orders, settings)
- **Cloudinary** (unsigned preset) for image uploads
- **EmailJS** for sending order emails (customer & admin)

---

## Files supplied
- `package.json`
- `public/index.html`
- `src/firebase.js` — put your Firebase config here
- `src/utils/email.js` — EmailJS keys (public key, service id, template ids)
- `src/index.js`
- `src/App.jsx`
- `src/styles.css`
- `src/components/StoreFront.jsx` (store/front-end)
- `src/components/AdminPanel.jsx` (admin dashboard)
- `README.md`

---

## Setup (phone-friendly)
1. Create GitHub repo and push all files/folders exactly as above.
   - On phone use GitHub mobile app or browser (desktop view) to create files and paste code.

2. In the project root run:
   ```bash
   npm install
   npm run build
