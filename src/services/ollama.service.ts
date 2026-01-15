// ollama.service.ts
import axios from "axios";

export class OllamaService {
  private ollamaUrl: string;
  private enabled: boolean;

  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    this.enabled = process.env.OLLAMA_ENABLED === "true";
  }

  async generateSpecificTopic(category: string): Promise<string | null> {
    if (!this.enabled) {
      console.log("⚠️ Ollama is disabled, using fallback topics");
      return null;
    }

    try {
      const prompt = `Generate ONE specific Khmer word related to "${category}".
For example:
- If category is "អាហារ" (food), return specific food like "សាច់អាំង" (grilled meat) or "សម្លកកូរ" (Khmer curry)
- If category is "ផ្លែឈើ" (fruit), return specific fruit like "ស្វាយ" (mango) or "ចេក" (banana)
- If category is "សត្វ" (animal), return specific animal like "ខ្លា" (tiger) or "ដំរី" (elephant)

Return ONLY ONE specific Khmer word, nothing else. No explanation, no punctuation.`;

      const response = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: process.env.OLLAMA_MODEL || "llama3.2",
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.8,
            top_p: 0.9,
            num_predict: 20,
          },
        },
        {
          timeout: 10000, // 10 second timeout
        }
      );

      const generatedText = response.data.response.trim();

      // Clean up the response - take only the first word
      const specificTopic = generatedText.split(/[\s\n,]/)[0].trim();

      if (specificTopic && specificTopic.length > 0) {
        console.log(
          `✅ Ollama generated topic: ${category} → ${specificTopic}`
        );
        return specificTopic;
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNREFUSED") {
          console.error("❌ Ollama connection refused. Is Ollama running?");
        } else if (error.code === "ETIMEDOUT") {
          console.error("❌ Ollama request timeout");
        } else {
          console.error("❌ Ollama error:", error.message);
        }
      } else {
        console.error("❌ Ollama error:", error);
      }
      return null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
