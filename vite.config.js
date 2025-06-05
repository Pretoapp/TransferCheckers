// vite.config.js
import { defineConfig } from 'vite';
// import basicSsl from '@vitejs/plugin-basic-ssl'; // You have this in devDependencies

export default defineConfig({
  plugins: [
    // basicSsl() // Uncomment if you want/need https for localhost
  ],
  server: {
    open: true, // Optional: to automatically open the app in your browser
    // port: 5173, // Optional: Vite's default port, change if needed
  }
});
