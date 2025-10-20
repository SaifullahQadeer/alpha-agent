import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = 'AIzaSyC6bGcRAXbcHbRasEKBcdv86fen5Uk93_c';

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    this.chatSession = null;
  }

  async generateContent(prompt) {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating content:', error);
      throw error;
    }
  }

  async startChat(history = []) {
    this.chatSession = this.model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });
    return this.chatSession;
  }

  async sendMessage(message) {
    try {
      if (!this.chatSession) {
        await this.startChat();
      }
      const result = await this.chatSession.sendMessage(message);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async analyzeData(data) {
    const prompt = `Analyze the following data and provide insights: ${JSON.stringify(data)}`;
    return await this.generateContent(prompt);
  }

  async getDashboardSummary(stats) {
    const prompt = `Given these dashboard statistics: ${JSON.stringify(stats)}, provide a brief executive summary highlighting key insights and trends in 2-3 sentences.`;
    return await this.generateContent(prompt);
  }
}

export default new GeminiService();
