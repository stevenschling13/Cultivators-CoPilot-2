
import { GeminiNetwork } from './network';
import { GenerateContentBody, GeminiResponse } from './types';
import { VoiceCommandResponse } from '../../types';
import { VOICE_COMMAND_INSTRUCTION } from '../../constants';

export class GeminiAudio {
  constructor(private network: GeminiNetwork) {}

  public async generateAudioBriefing(text: string): Promise<ArrayBuffer> {
      const body = {
          contents: [{ parts: [{ text }] }],
          config: { responseModalities: ["AUDIO"] }
      };
      
      const response = await this.network.callProxy<GeminiResponse>(
          'v1beta/models/gemini-2.5-flash-preview-tts:generateContent', 
          body
      );
      
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio generated");

      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
  }

  public async processVoiceCommand(audioBlob: Blob): Promise<VoiceCommandResponse> {
      const base64 = await this.network.blobToBase64(audioBlob);
      const body: GenerateContentBody = {
          contents: [{
              parts: [
                  { inlineData: { mimeType: 'audio/webm', data: base64 } },
                  { text: VOICE_COMMAND_INSTRUCTION }
              ]
          }],
          generationConfig: { responseMimeType: 'application/json' }
      };
      const data = await this.network.callProxy<GeminiResponse>('v1beta/models/gemini-2.5-flash:generateContent', body);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? JSON.parse(text) : {} as VoiceCommandResponse;
  }
}
