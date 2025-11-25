import { GroundingMetadata } from '../../types';

export type FinishReason = 
  | 'FINISH_REASON_UNSPECIFIED'
  | 'STOP'
  | 'MAX_TOKENS'
  | 'SAFETY'
  | 'RECITATION'
  | 'OTHER'
  | 'BLOCKLIST'
  | 'PROHIBITED_CONTENT'
  | 'SPII'
  | 'MALFORMED_FUNCTION_CALL';

export type SafetyRatingCategory = 
  | 'HARM_CATEGORY_HATE_SPEECH'
  | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
  | 'HARM_CATEGORY_HARASSMENT'
  | 'HARM_CATEGORY_DANGEROUS_CONTENT'
  | 'HARM_CATEGORY_UNSPECIFIED';

export type SafetyRatingProbability = 
  | 'NEGLIGIBLE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'PROBABILITY_UNSPECIFIED';

export type BlockReason = 
  | 'BLOCK_REASON_UNSPECIFIED'
  | 'SAFETY'
  | 'OTHER';

export type SchemaType = 
  | 'TYPE_UNSPECIFIED'
  | 'STRING'
  | 'NUMBER'
  | 'INTEGER'
  | 'BOOLEAN'
  | 'ARRAY'
  | 'OBJECT';

export interface InlineData {
  mimeType: string;
  data: string;
}

export interface FileData {
  mimeType: string;
  fileUri: string;
}

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface FunctionResponse {
  name: string;
  response: Record<string, any>;
}

export interface ExecutableCode {
  language: 'PYTHON';
  code: string;
}

export interface CodeExecutionResult {
  outcome: 'OUTCOME_OK' | 'OUTCOME_FAILED' | 'OUTCOME_DEADLINE_EXCEEDED';
  output: string;
}

export interface Part {
  text?: string;
  inlineData?: InlineData;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
  fileData?: FileData;
  executableCode?: ExecutableCode;
  codeExecutionResult?: CodeExecutionResult;
}

export interface Content {
  role?: string;
  parts: Part[];
}

export interface SafetyRating {
  category: SafetyRatingCategory;
  probability: SafetyRatingProbability;
  blocked?: boolean;
}

export interface PromptFeedback {
  blockReason?: BlockReason;
  safetyRatings?: SafetyRating[];
}

export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface CitationSource {
  startIndex?: number;
  endIndex?: number;
  uri?: string;
  license?: string;
}

export interface CitationMetadata {
  citationSources: CitationSource[];
}

export interface GeminiCandidate {
  content?: Content;
  finishReason?: FinishReason;
  safetyRatings?: SafetyRating[];
  citationMetadata?: CitationMetadata;
  tokenCount?: number;
  index?: number;
  groundingMetadata?: GroundingMetadata;
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: PromptFeedback;
  usageMetadata?: UsageMetadata;
}

export interface Schema {
  type: SchemaType;
  format?: string;
  description?: string;
  nullable?: boolean;
  enum?: string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: Schema;
}

export interface Tool {
  functionDeclarations?: FunctionDeclaration[];
  googleSearch?: Record<string, never>;
  codeExecution?: Record<string, never>;
}

export interface ToolConfig {
  functionCallingConfig?: {
    mode: 'ANY' | 'AUTO' | 'NONE';
    allowedFunctionNames?: string[];
  };
}

export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  candidateCount?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: Schema;
  thinkingConfig?: { thinkingBudget: number };
}

export interface GenerateContentBody {
  contents: Content[];
  tools?: Tool[];
  toolConfig?: ToolConfig;
  safetySettings?: { category: SafetyRatingCategory; threshold: string }[];
  systemInstruction?: Content;
  generationConfig?: GenerationConfig;
}

export interface LiveSession {
  sendRealtimeInput: (input: { media: { mimeType: string; data: string } }) => void;
  sendToolResponse: (response: unknown) => void;
  close: () => void;
  then: (cb: (s: LiveSession) => void) => void;
}