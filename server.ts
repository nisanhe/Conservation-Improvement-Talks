import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API Routes
app.post("/api/analyze-insight", async (req, res) => {
  const { currentInsight, allInsights } = req.body;

  if (!currentInsight || !currentInsight.title) {
    return res.status(400).json({ error: "Missing insight data" });
  }

  try {
    const prompt = `
אתה "מאמן צמיחה אישי" (Personal Growth Coach). המטרה שלך היא לעזור למשתמש ללמוד מהעבר שלו ולשפר את עצמו בזמן אמת.
קיבלת תובנה חדשה שהמשתמש מזין כרגע:
כותרת: ${currentInsight.title}
מה לשמר: ${currentInsight.keepContent}
מה לשפר: ${currentInsight.improveContent}

להלן רשימת תובנות קודמות של המשתמש:
${allInsights.map((i: any) => `- ${i.title}: לשמר (${i.keepContent}), לשפר (${i.improveContent})`).join('\n')}

המשימה שלך היא "לחבר את הנקודות":
1. זהה קשרים ישירים או עקיפים לתובנות מהעבר.
2. אם מצאת דמיון, הסבר למשתמש מה הוא כבר למד בעבר ואיך זה עוזר לו עכשיו ("כבר למדת בסיטואציה X ש...").
3. אם אין קשר ישיר, תן עצה קצרה ומבריקה איך לקחת את הלמידה הזו צעד אחד קדימה.
4. השתמש בטון מעצים, מקצועי ומניע לפעולה.

ענה בעברית בצורה מובנית (Markdown). השתמש בבולטים. אל תכתוב "שלום" או "אני עוזר", גש ישר לעניין.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    res.json({ analysis: response.text });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to analyze insight" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
