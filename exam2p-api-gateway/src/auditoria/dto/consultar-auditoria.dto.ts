import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';

export class ConsultarAuditoriaDto {
  @IsOptional()
  @IsString()
  entidad?: string;

  @IsOptional()
  @IsEnum(['CREAR', 'ACTUALIZAR', 'ELIMINAR'])
  accion?: 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR';

  @IsOptional()
  @IsString()
  usuario?: string;

  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @IsOptional()
  @IsString()
  fechaHasta?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limite?: number = 10;
}