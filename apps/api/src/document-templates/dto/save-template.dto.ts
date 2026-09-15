import { Type } from "class-transformer";
import {
  IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, ValidateNested,
} from "class-validator";

class TemplateElementDto {
  @IsString() id!: string;
  @IsIn(["text", "image", "shape", "field"]) kind!: string;
  @IsNumber() x!: number;
  @IsNumber() y!: number;
  @IsNumber() width!: number;
  @IsNumber() height!: number;
  @IsNumber() rotation!: number;
  @IsNumber() zIndex!: number;
  @IsOptional() @IsBoolean() locked?: boolean;
  @IsOptional() @IsBoolean() hidden?: boolean;
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsString() fontFamily?: string;
  @IsOptional() @IsNumber() fontSize?: number;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() align?: string;
  @IsOptional() @IsString() field?: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() imageData?: string;
  @IsOptional() @IsString() shapeType?: string;
  @IsOptional() @IsString() fillColor?: string;
  @IsOptional() @IsString() borderColor?: string;
  @IsOptional() @IsNumber() borderWidth?: number;
}

export class SaveTemplateDto {
  @IsIn(["CARD", "CERTIFICATE"])
  type!: "CARD" | "CERTIFICATE";

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateElementDto)
  frontLayout!: TemplateElementDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateElementDto)
  backLayout?: TemplateElementDto[];

  @IsOptional()
  @IsString()
  referenceImageFront?: string;

  @IsOptional()
  @IsString()
  referenceImageBack?: string;

  @IsOptional()
  @IsString()
  customFontData?: string;
}
