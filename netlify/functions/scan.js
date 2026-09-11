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
    Kamu adalah kasir/akuntan ekstraksi struk makanan.
    Analisis gambar struk makanan ini dan kembalikan HANYA format JSON valid tanpa teks markdown/penjelasan tambahan.
    
    JSON Harus dengan skema:
    {
      "items": [
        { "person": "Nama Orang/Pemesan (Kosongkan string \"\" jika tidak ada di struk)", "name": "Nama Menu", "qty": 1, "price": 15000 }
      ],
      "discounts": 0,
      "fees": 0
    }
    `;

    const parts = images.map(img => ({
      inline_data: { mime_type: img.mimeType, data: img.data }
    }));
    parts.push({ text: promptText });

    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );

    const data = await googleResponse.json();

    if (!googleResponse.ok) {
      // Mengirim kembali error dari Google API
      return { statusCode: googleResponse.status, body: JSON.stringify(data) };
    }

    // Sukses
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    // Tangkap error lainnya dan pastikan kembaliannya berupa JSON
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: err.message || 'Terjadi kesalahan internal pada server' }) 
    };
  }
};
