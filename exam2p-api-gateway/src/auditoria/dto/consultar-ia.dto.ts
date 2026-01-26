import { IsString, IsNotEmpty } from 'class-validator';

export class ConsultarIaDto {
  @IsString()
  @IsNotEmpty()
  consulta: string;
}