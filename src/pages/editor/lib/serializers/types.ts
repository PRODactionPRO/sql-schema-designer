import type { Schema } from '../../model/types';

export interface SchemaSerializer {
  /** Уникальный идентификатор формата */
  id: string;
  /** Человекочитаемое название */
  name: string;
  /** Описание формата */
  description: string;
  /** Расширение файла */
  fileExtension: string;
  /** MIME тип */
  mimeType: string;

  /** Сериализация схемы в строку */
  serialize(schema: Schema): string;

  /** Десериализация строки в схему */
  deserialize(content: string): Schema;

  /** Поддерживает ли формат импорт */
  canImport: boolean;

  /** Поддерживает ли формат экспорт */
  canExport: boolean;
}
