import Joi from "joi";

interface JoiObjectSchema extends Joi.ObjectSchema {
  _ids: {
    _byKey: Map<String, { schema: Joi.AnySchema }>;
  };
}

export const getItemSchemaFromObjectSchema = (
  objectSchema: Joi.ObjectSchema,
  key: string
): Joi.AnySchema => {
  // This is a complete hack and should be opened as an issue against Joi to get a proper API
  const itemSchema = (objectSchema as JoiObjectSchema)._ids._byKey.get(key)
    ?.schema;
  // This must mean unknown is enabled
  if (!itemSchema) {
    return Joi.any();
  }
  return itemSchema;
};
