import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, FunctionCallingMode, GenerativeModel, ChatSession, GenerateContentResult } from '@google/generative-ai';
import { McpClientService } from '../mcp-client/mcp-client.service';

interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

interface FunctionResponse {
  functionResponse: {
    name: string;
    response: any;
  };
}

interface GeminiResponse {
  functionCalls?: () => FunctionCall[] | undefined;
  text: () => string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: GenerativeModel;

  constructor(private readonly mcpClient: McpClientService) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('❌ GEMINI_API_KEY no encontrada en variables de entorno');
    }

    // Crear cliente base de Gemini usando a apiKey
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Seleccionar el modelo generativo específico
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });

    this.logger.log('✅ Gemini Service initialized with model: gemini-2.5-flash');
  }

  async processRequest(userPrompt: string): Promise<string> {
    this.logger.log(`Nueva solicitud de usuario`);
    this.logger.log(`Prompt: "${userPrompt}"`);

    try {
      // Paso 1: Obtener tools disponibles del MCP Server
      const mcpTools = await this.mcpClient.listTools() as McpTool[];
      this.logger.log(`   ✅ ${mcpTools.length} tools disponibles`);

      // Paso 2: Convertir MCP tools a formato de Gemini
      this.logger.log('Convirtiendo tools a formato Gemini...');
      const functionDeclarations = mcpTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        parameters: tool.inputSchema,
      }));

      // Paso 3: Configurar chat con Gemini
      this.logger.log('Iniciando chat con Gemini...');
      const chat: ChatSession = this.model.startChat({
        tools: [{ functionDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingMode.AUTO, // Gemini decide automáticamente
          },
        },
      });

      // Paso 4: Enviar mensaje inicial
      this.logger.log('Enviando prompt a Gemini...');
      let result: GenerateContentResult = await chat.sendMessage(userPrompt);
      let response = result.response as GeminiResponse;

      // Paso 5: Loop de ejecución de function calls
      let iterationCount = 0;
      const maxIterations = 10; // Prevenir loops infinitos

      let functionCalls = response.functionCalls?.();
      while (functionCalls && functionCalls.length > 0) {
        iterationCount++;
        
        if (iterationCount > maxIterations) {
          throw new Error('Se alcanzó el límite de iteraciones');
        }

        this.logger.log(`Iteración ${iterationCount}: Gemini quiere llamar ${functionCalls.length} función(es)`);

        // Ejecutar todas las function calls
        const functionResponses: FunctionResponse[] = await Promise.all(
          functionCalls.map(async (call) => {
            this.logger.log(`   🔧 Ejecutando: ${call.name}`);
            this.logger.log(`   📥 Argumentos: ${JSON.stringify(call.args, null, 2)}`);

            try {
              // Llamar al MCP Server para ejecutar el tool
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const toolResult = await this.mcpClient.callTool(
                call.name,
                call.args,
              );

              this.logger.log(`   ✅ ${call.name} ejecutado exitosamente`);
              this.logger.log(`   📤 Resultado: ${JSON.stringify(toolResult, null, 2)}`);

              return {
                functionResponse: {
                  name: call.name,
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  response: toolResult,
                },
              };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              this.logger.error(`   ❌ Error en ${call.name}: ${errorMessage}`);
              
              return {
                functionResponse: {
                  name: call.name,
                  response: {
                    error: errorMessage,
                    success: false,
                  },
                },
              };
            }
          }),
        );

        // Paso 6: Enviar resultados de vuelta a Gemini
        this.logger.log('Enviando resultados a Gemini...');
        result = await chat.sendMessage(functionResponses);
        response = result.response as GeminiResponse;
        functionCalls = response.functionCalls?.();
      }

      // Paso 7: Obtener respuesta final en lenguaje natural
      this.logger.log('Generando respuesta final...');
      const finalResponse: string = response.text();
      
      this.logger.log('Respuesta generada exitosamente');
      this.logger.log(`Respuesta: "${finalResponse}"`);

      return finalResponse;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('❌ Error procesando solicitud');
      this.logger.error(`Error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Verificar que Gemini esté funcionando
   */
  async healthCheck(): Promise<{ status: string; model: string }> {
    try {
      await this.model.generateContent('Test');
      return { status: 'ok', model: 'gemini-2.0-flash-exp' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Gemini no disponible: ${errorMessage}`);
    }
  }
}