import AWS from "aws-sdk";
import Joi from "joi";
import type { JoiObjectSchema, PlainObject, Schema } from "./types";

class Serializer {
  constructor(private schema: Schema) {}

  private string(value: string): AWS.DynamoDB.AttributeValue {
    return { S: value };
  }

  private number(value: number): AWS.DynamoDB.AttributeValue {
    return { N: value.toString() };
  }

  private boolean(value: boolean): AWS.DynamoDB.AttributeValue {
    return { BOOL: value };
  }

  private object(
    o: PlainObject,
    schema: Joi.ObjectSchema
  ): AWS.DynamoDB.AttributeValue {
    if (o === null) {
      return { NULL: true };
    }
    if (o instanceof Buffer) {
      throw new Error("Buffers not yet supported yet");
    }
    return {
      M: this.toDynamoMap(o, schema),
    };
  }

  private array(
    a: any[],
    schema: Joi.ArraySchema
  ):
    | {
        SS: AWS.DynamoDB.StringSetAttributeValue;
      }
    | {
        L: AWS.DynamoDB.ListAttributeValue;
      }
    | undefined {
    if (a.length === 0) {
      return undefined;
    }

    const meta = schema.describe().metas?.[0]?.type;
    switch (meta) {
      case "SS":
        return { SS: a };
      default:
        return {
          L: a
            .map((item) => this.any(item))
            .filter(Boolean) as AWS.DynamoDB.AttributeValue[],
        };
    }
  }

  private any(value: any): AWS.DynamoDB.AttributeValue | undefined {
    const type = typeof value;

    if (type === "boolean") {
      return this.boolean(value);
    }
    if (type === "number") {
      return this.number(value);
    }
    if (type === "string") {
      return this.string(value);
    }
    if (type === "object") {
      if (Array.isArray(value)) {
        return this.array(value, Joi.array().items(Joi.any()));
      }
      if (value === null) {
        return this.object(value, Joi.object());
      }

      // Build an object schema to look through made from the known keys
      const objectSchema = Object.keys(value).reduce(
        (structure, key) => ({
          ...structure,
          [key]: Joi.any(),
        }),
        {}
      );
      return this.object(value, Joi.object(objectSchema));
    }
    throw new Error(`Cannot serialize "${type}" to DynamoDB`);
  }

  toDynamoValue(
    userValue: any,
    schemaKey: string | Joi.AnySchema
  ): AWS.DynamoDB.AttributeValue | undefined {
    const schema =
      typeof schemaKey === "string" ? this.schema[schemaKey] : schemaKey;

    if (userValue === undefined) {
      return undefined;
    }

    if (schema.type === "object") {
      return this.object(userValue, schema as Joi.ObjectSchema);
    } else if (schema.type === "array") {
      return this.array(userValue, schema as Joi.ArraySchema);
    } else if (schema.type === "number") {
      return this.number(userValue);
    } else if (schema.type === "string") {
      return this.string(userValue);
    } else if (schema.type === "boolean") {
      return this.boolean(userValue);
    } else if (schema.type === "any") {
      return this.any(userValue);
    } else {
      throw new Error(`Unable to handle Joi schema type: "${schema.type}"`);
    }
  }

  toDynamoMap(
    userObj: PlainObject,
    schema?: Joi.ObjectSchema
  ): AWS.DynamoDB.AttributeMap {
    const parentSchema = schema || this.schema;

    return Object.entries(userObj).reduce((dynamoObj, [key, userValue]) => {
      let itemSchema: Joi.AnySchema | undefined;
      if (parentSchema.type === "object") {
        // This is a complete hack and should be opened as an issue against Joi to get a proper API
        itemSchema = (parentSchema as JoiObjectSchema)._ids._byKey.get(key)
          ?.schema;
      } else {
        itemSchema = (parentSchema as Schema)[key];
      }

      // Cannot recreate this state but TS is certain it exists
      if (!itemSchema) {
        throw new Error(`Could not find schema for "${key}"`);
      }

      const dynamoValue = this.toDynamoValue(userValue, itemSchema);
      if (dynamoValue === undefined) {
        return dynamoObj;
      }
      return {
        ...dynamoObj,
        [key]: dynamoValue,
      };
    }, {});
  }
}

export default Serializer;
