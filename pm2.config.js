module.exports = {
  apps: [
    {
      // Nama aplikasi Anda di PM2
      name: "ganeshadcert",
      
      // Mode cluster untuk performa lebih baik
      exec_mode: "cluster",
      
      // Jumlah instance, 'max' akan menggunakan semua core CPU yang tersedia
      instances: "max", 
      
      // File utama yang akan dijalankan setelah proses build
      script: "./dist/index.js", // <-- PENTING: Pastikan path ini benar!
      
      // Aktifkan 'watch' hanya untuk development jika perlu
      watch: false,

      // Konfigurasi untuk lingkungan development
      env_dev: {
        NODE_ENV: "development",
        // PORT bisa diambil dari secrets GitHub, tapi bisa juga didefinisikan di sini
        // PM2 akan memprioritaskan variabel dari file ini jika didefinisikan
      },

      // Konfigurasi untuk lingkungan produksi
      env_prod: {
        NODE_ENV: "production",
      },
    },
  ],
};