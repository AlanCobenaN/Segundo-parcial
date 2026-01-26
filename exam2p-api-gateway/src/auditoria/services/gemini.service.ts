import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, FunctionDeclaration, Tool } from '@google/generative-ai';
import { ConsultarAuditoriaDto } from '../dto/consultar-auditoria.dto';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    
    if (!apiKey) {
      throw new Error('❌ GEMINI_API_KEY no configurada en .env');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // ⚠️ CRÍTICO: Usar gemini-2.5-flash, NO gemini-pro
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 1,
      },
    });

    this.logger.log('✅ Gemini configurado con modelo: gemini-2.5-flash');
  }

  private getFunctionDeclarations(): FunctionDeclaration[] {
    return [
      {
        name: 'exam2p_consultar_auditoria',
        description: 'Consulta registros de auditoría del sistema. Permite filtrar por entidad, acción, usuario o rango de fechas.',
        parameters: {
          type: 'object' as any,
          properties: {
            entidad: {
              type: 'string' as any,
              description: 'Nombre de la entidad a filtrar (ej: "Producto", "Usuario"). Opcional.',
            },
            accion: {
              type: 'string' as any,
              enum: ['CREAR', 'ACTUALIZAR', 'ELIMINAR'],
              description: 'Tipo de acción a filtrar. Opcional.',
            },
            usuario: {
              type: 'string' as any,
              description: 'Usuario que realizó la acción. Opcional.',
            },
            fechaDesde: {
              type: 'string' as any,
              description: 'Fecha inicio en formato ISO (YYYY-MM-DD). Opcional.',
            },
            fechaHasta: {
              type: 'string' as any,
              description: 'Fecha fin en formato ISO (YYYY-MM-DD). Opcional.',
            },
            limite: {
              type: 'number' as any,
              description: 'Número máximo de registros a retornar. Por defecto 10.',
            },
          },
          required: [],
        },
      },
    ];
  }

  async procesarConsulta(
    consulta: string,
    ejecutarFuncion: (params: ConsultarAuditoriaDto) => Promise<any>,
  ): Promise<string> {
    this.logger.log(`🤖 Procesando consulta: "${consulta}"`);

    const tools: Tool[] = [
      {
        functionDeclarations: this.getFunctionDeclarations(),
      },
    ];

    const chat = this.model.startChat({
      tools,
      history: [],
    });

    const prompt = `
Eres un asistente especializado en consultas de auditoría.
El usuario pregunta: "${consulta}"

Usa la función exam2p_consultar_auditoria para obtener los datos necesarios.
Debes interpretar la consulta del usuario y extraer:
- Entidad mencionada (Producto, Usuario, etc.)
- Acción mencionada (eliminar, crear, actualizar)
- Usuario mencionado
- Rango de fechas mencionado

Si el usuario pregunta sobre "eliminaciones", usa accion: "ELIMINAR".
Si pregunta "qué hizo el usuario X", usa usuario: "X".
Si no especifica límite, usa 10 registros.

Luego, presenta los resultados en formato legible y amigable.
`;

    let result = await chat.sendMessage(prompt);
    let response = result.response;

    this.logger.log('📨 Respuesta inicial de Gemini recibida');

    // Manejar Function Calling iterativo
    let iteraciones = 0;
    const maxIteraciones = 5;

    while (
      response.candidates &&
      response.candidates[0]?.content?.parts?.some((part) => part.functionCall) &&
      iteraciones < maxIteraciones
    ) {
      iteraciones++;
      this.logger.log(`🔄 Iteración ${iteraciones}: Function call detectado`);

      const functionCalls = response.candidates[0].content.parts.filter(
        (part) => part.functionCall,
      );

      const functionResponses: any[] = [];

      for (const functionCall of functionCalls) {
        const { name, args } = functionCall.functionCall;

        this.logger.log(`📞 Llamando función: ${name}`);
        this.logger.log(`📦 Argumentos: ${JSON.stringify(args, null, 2)}`);

        if (name === 'exam2p_consultar_auditoria') {
          try {
            const resultado = await ejecutarFuncion(args as ConsultarAuditoriaDto);

            this.logger.log(`✅ Función ejecutada. Total: ${resultado.total} registros`);

            functionResponses.push({
              functionResponse: {
                name: name,
                response: {
                  success: true,
                  data: resultado,
                },
              },
            });
          } catch (error) {
            this.logger.error(`❌ Error ejecutando función: ${error.message}`);

            functionResponses.push({
              functionResponse: {
                name: name,
                response: {
                  success: false,
                  error: error.message,
                },
              },
            });
          }
        }
      }

      // ⚠️ PREVENCIÓN: Cast para evitar errores de tipo TypeScript
      result = await chat.sendMessage(functionResponses as any);
      response = result.response;

      this.logger.log(`📨 Respuesta después de function call recibida`);
    }

    if (iteraciones >= maxIteraciones) {
      this.logger.warn('⚠️ Máximo de iteraciones alcanzado');
    }

    const finalText = response.text();
    this.logger.log(`✅ Respuesta final generada: ${finalText.substring(0, 100)}...`);

    return finalText;
  }
}