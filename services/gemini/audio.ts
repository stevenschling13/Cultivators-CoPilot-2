
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceCommandResponse } from '../../types';
import { VOICE_COMMAND_INSTRUCTION } from '../../constants';
import { safeParseAIResponse } from './utils';
import { VoiceCommandResponseSchema } from '../../system/schema';

export class GeminiAudio {
  constructor(private ai: GoogleGenAI) {}

  public async generateAudioBriefing(text: string): Promise<ArrayBuffer> {
      const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-tts',
          contents: [{ parts: [{ text }] }],
          config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                  voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Kore' }
                  }
              }
          }
      });

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
      // Convert Blob to Base64
      const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(audioBlob);
      });

      const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
              parts: [
                  { inlineData: { mimeType: 'audio/webm', data: base64 } },
                  { text: VOICE_COMMAND_INSTRUCTION }
              ]
          },
          config: { responseMimeType: 'application/json' }
      });
      
      return safeParseAIResponse(response.text, VoiceCommandResponseSchema, 'processVoiceCommand');
  }
}
