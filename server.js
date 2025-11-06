const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const { Resend } = require("resend");

const app = express();
app.use(cors());
app.use(express.json());

// Uploady do tymczasowego katalogu (Render i tak czyści /uploads)
const upload = multer({ dest: "uploads/" });

// 🔑 Używamy zmiennej środowiskowej z Render (nie zapisujemy klucza w kodzie!)
const resend = new Resend(process.env.RESEND_API_KEY);

// 🔔 Endpoint testowy
app.get("/", (req, res) => {
  res.send("✅ Backend działa na Render! 🚀");
});

// 🎤 Odbieranie wiadomości głosowych
app.post("/voice-message", upload.single("audio"), async (req, res) => {
  try {
    const { recipient, duration } = req.body;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({ error: "Brak pliku audio" });
    }

    console.log("📩 Wysyłanie wiadomości głosowej...");

    const audioBuffer = fs.readFileSync(audioFile.path);

    const { data, error } = await resend.emails.send({
      from: "Nasze Radio <onboarding@resend.dev>",
      to: recipient || "portalnaszefm@gmail.com",
      subject: "🎤 Nowa wiadomość głosowa od słuchacza",
      html: `
        <h2>Otrzymałeś nową wiadomość głosową!</h2>
        <p><strong>Czas nagrania:</strong> ${duration} sekund</p>
        <p><strong>Data:</strong> ${new Date().toLocaleString("pl-PL")}</p>
        <p>Wiadomość znajduje się w załączniku.</p>
      `,
      attachments: [
        {
          filename: `wiadomosc_${Date.now()}.m4a`,
          content: audioBuffer,
        },
      ],
    });

    fs.unlinkSync(audioFile.path); // usuń tymczasowy plik

    if (error) throw error;

    console.log("✅ Wysłano! ID:", data.id);
    res.json({ success: true, message: "Wiadomość wysłana" });
  } catch (error) {
    console.error("❌ Błąd:", error);
    res.status(500).json({ error: "Błąd wysyłania wiadomości" });
  }
});

// 📰 Endpoint reporterski (zdjęcia, film, audio)
app.post(
  "/reporter-upload",
  upload.fields([
    { name: "photos", maxCount: 10 },
    { name: "video", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { nickname, audioDuration } = req.body;
      const files = req.files;

      if (!nickname) {
        return res.status(400).json({ error: "Brak nicku" });
      }
      if (!files || Object.keys(files).length === 0) {
        return res.status(400).json({ error: "Brak plików" });
      }

      const attachments = [];
      let contentDescription = "";

      if (files.photos && files.photos.length > 0) {
        files.photos.forEach((photo, index) => {
          const photoBuffer = fs.readFileSync(photo.path);
          attachments.push({
            filename: `${nickname}_zdjecie_${index + 1}_${Date.now()}.jpg`,
            content: photoBuffer,
          });
          fs.unlinkSync(photo.path);
        });
        contentDescription += `📸 Zdjęć: ${files.photos.length}\n`;
      }

      if (files.video) {
        const video = files.video[0];
        const videoBuffer = fs.readFileSync(video.path);
        attachments.push({
          filename: `${nickname}_film_${Date.now()}.mp4`,
          content: videoBuffer,
        });
        contentDescription += "🎬 Film\n";
        fs.unlinkSync(video.path);
      }

      if (files.audio) {
        const audio = files.audio[0];
        const audioBuffer = fs.readFileSync(audio.path);
        attachments.push({
          filename: `${nickname}_audio_${Date.now()}.m4a`,
          content: audioBuffer,
        });
        contentDescription += `🎤 Relacja głosowa (${audioDuration || "?"}s)\n`;
        fs.unlinkSync(audio.path);
      }

      const { data, error } = await resend.emails.send({
        from: "Nasze Radio Reporter <onboarding@resend.dev>",
        to: "portalnaszefm@gmail.com",
        subject: `📰 Materiał reporterski od: ${nickname}`,
        html: `
          <h2>Nowy materiał reporterski!</h2>
          <p><strong>Reporter:</strong> ${nickname}</p>
          <p><strong>Data:</strong> ${new Date().toLocaleString("pl-PL")}</p>
          <hr>
          <h3>Przesłane materiały:</h3>
          <pre>${contentDescription}</pre>
        `,
        attachments,
      });

      if (error) throw error;

      console.log("✅ Materiał wysłany! ID:", data.id);
      res.json({ success: true, message: "Materiał wysłany" });
    } catch (error) {
      console.error("❌ Błąd:", error);
      res.status(500).json({ error: "Błąd wysyłania materiału" });
    }
  }
);

// 🔥 najważniejsza zmiana dla Render: PORT z ENV
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎧 Server działa na porcie ${PORT}`);
});
