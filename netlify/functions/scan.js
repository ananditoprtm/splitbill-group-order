exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'API Key belum dipasang di Netlify Environment Variables!' }) 
      };
    }

    const body = JSON.parse(event.body);
    const { images } = body;
    
    if (!images || images.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Tidak ada gambar yang dikirim.' }) };
    }

    const promptText = `
    Kamu adalah sistem OCR dan akuntan khusus ekstraksi struk aplikasi makanan (ShopeeFood, GrabFood, GoFood).
    Analisis gambar struk makanan ini dan kembalikan HANYA format JSON valid sesuai skema berikut:

    {
      "items": [
        { 
          "person": "Nama Orang/Pemesan jika ada di struk (kosongkan \"\" jika tidak ada)", 
          "name": "Nama Menu Lengkap", 
          "qty": 1, 
          "price": 15000 
        }
      ],
      "discounts": 0,
      "fees": 0
    }

    ATURAN PENTING EKSTRAKSI DATA:
    1. HARGA SATUAN (price): 
       - Nilai 'price' HARUS berupa HARGA SATUAN (harga per 1 porsi/pcs), BUKAN total subbaris!
       - Pada aplikasi seperti ShopeeFood/GrabFood/GoFood, angka di sebelah kanan nama menu (misal Rp 77.600) sering kali merupakan Total Harga Subbaris. 
       - Jika Qty > 1 (misal 'x 2'), kamu WAJIB membagi Total Harga Subbaris dengan Qty untuk mendapatkan 'price' per unit (contoh: 77600 / 2 = 38800).
       - Pastikan 'price' bernilai angka bulat tanpa titik/koma/simbol Rp.
    2. TOTAL DISKON (discounts):
       - Jumlahkan SEMUA potongan harga (Diskon Group Order, Voucher Diskon, Diskon Toko, Promo, dll).
       - Kembalikan nilainya sebagai angka positif bulat (contoh: jika diskon -Rp7.243 dan -Rp65.183, maka discounts = 72426).
    3. TOTAL BIAYA TAMBAHAN (fees):
       - Jumlahkan SEMUA biaya ekstra (Biaya Pengiriman/Ongkir, Biaya Layanan, Biaya Penanganan, Kemasan, dll).
       - Kembalikan nilainya sebagai angka positif bulat (contoh: Ongkir Rp9.500 + Layanan Rp1.500 = fees 11000).
    4. NAMA PEMESAN (person):
       - Jika struk memiliki nama pemesan per grup (seperti ShopeeFood Group Order), petakan tiap menu ke nama pemesannya masing-masing.
    `;

    const parts = images.map(img => ({
      inline_data: { mime_type: img.mimeType, data: img.data }
    }));
    parts.push({ text: promptText });

    // Memanggil API Gemini dengan model resmi dan valid
    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts }],
          generationConfig: {
            response_mime_type: "application/json"
          }
        })
      }
    );

    const data = await googleResponse.json();

    if (!googleResponse.ok) {
      return { statusCode: googleResponse.status, body: JSON.stringify(data) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: err.message || 'Terjadi kesalahan internal pada server' }) 
    };
  }
};
