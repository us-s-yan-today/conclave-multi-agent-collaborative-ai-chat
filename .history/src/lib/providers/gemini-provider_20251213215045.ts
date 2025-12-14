import { AIProvider, ProviderConfig } from './base-provider';

export class GeminiProvider implements AIProvider {
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async processMessage(
    message: string,
    history: any[],
    model: string,
    onChunk?: (chunk: string) => void,
    systemPrompt?: string,
    personality?: string
  ): Promise<{ content: string; toolCalls?: any[] }> {
    // Normalize model name - remove google-ai-studio/ prefix if present
    const normalizedModel = model.startsWith('google-ai-studio/') 
      ? model.replace('google-ai-studio/', '') 
      : model;
    
    const apiKey = this.config.apiKey;
    const contents = [];
    
    // Build system message if provided
    let systemMessage = '';
    if (systemPrompt) {
      systemMessage = systemPrompt;
    }
    if (personality && !systemPrompt?.includes(personality)) {
      systemMessage = systemMessage ? `${systemMessage}\n\nYour personality: ${personality}` : `Your personality: ${personality}`;
    }
    
    // Add system prompt if exists
    if (systemMessage) {
      contents.push({
        role: 'user',
        parts: [{ text: systemMessage }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow these guidelines.' }]
      });
    }
    
    // Add recent conversation history (last 5 messages)
    const recentHistory = history.slice(-5);
    contents.push(
      ...recentHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }))
    );
    
    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });
    
    // Build Gemini API request
    const endpoint = this.config.endpoint || `/v1/models/${normalizedModel}:generateContent`;
    const url = `${this.config.baseURL}${endpoint.replace('{model}', normalizedModel)}`;
    
    const requestBody = {
      contents,
      generationConfig: {
        maxOutputTokens: 8000,
        temperature: 0.7
      }
    };
    
    // Log the request for debugging
    console.log('=== Gemini API Request ===');
    console.log('Base URL:', this.config.baseURL);
    console.log('Endpoint:', endpoint);
    console.log('Full URL:', url);
    console.log('Model (original):', model);
    console.log('Model (normalized):', normalizedModel);
    console.log('SystemPrompt received:', systemPrompt ? 'YES' : 'NO');
    console.log('Personality received:', personality ? 'YES' : 'NO');
    console.log('System message built:', systemMessage ? 'YES' : 'NO');
    console.log('Contents array length:', contents.length);
    console.log('First 2 items in contents:', JSON.stringify(contents.slice(0, 2), null, 2));
    console.log('Full request body:', JSON.stringify(requestBody, null, 2));
    console.log('========================');
    
    const response = await fetch(`${url}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (onChunk) {
      for (const char of content) {
        onChunk(char);
      }
    }

    return { content };
  }
}
