import * as AWSDDB from "@aws-sdk/client-dynamodb";
import Joi from "joi";
import type { PlainObject } from "./types";
import { getItemSchemaFromObjectSchema } from "./joiReflection";

class Serializer {
  constructor(private schema: Joi.ObjectSchema, private version: number) {}

  private string(value: string): AWSDDB.AttributeValue {
    return { S: value };
  }

  private number(value: number): AWSDDB.AttributeValue {
    return { N: value.toString() };
  }

  private boolean(value: boolean): AWSDDB.AttributeValue {
    return { BOOL: value };
  }

  private date(value: Date): AWSDDB.AttributeValue {
    return this.string(value.toISOString());
  }

  private object(
    o: PlainObject,
    schema: Joi.ObjectSchema
  ): AWSDDB.AttributeValue {
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
        SS: string[];
      }
    | {
        L: AWSDDB.AttributeValue[];
      }
    | undefined {
    if (a.length === 0) {
      return undefined;
    }

    const description = schema.describe();
    const meta = description.metas?.[0]?.type;
    if (meta === "SS") {
      return { SS: a };
    }

    const itemsSchema = schema.$_terms.items[0];
    if (itemsSchema) {
      return {
        L: a
          .map((item) => this.toDynamoValue(item, itemsSchema))
          .filter(Boolean) as AWSDDB.AttributeValue[],
      };
    }

    return {
      L: a
        .map((item) => this.any(item))
        .filter(Boolean) as AWSDDB.AttributeValue[],
    };
  }

  private any(value: any): AWSDDB.AttributeValue | undefined {
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
  ): AWSDDB.AttributeValue | undefined {
    const schema =
      typeof schemaKey === "string"
        ? getItemSchemaFromObjectSchema(this.schema, schemaKey)
        : schemaKey;

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
    } else if (schema.type === "date") {
      return this.date(userValue);
    } else {
      throw new Error(`Unable to handle Joi schema type: "${schema.type}"`);
    }
  }

  private toDynamoMap(
    userObj: PlainObject,
    objectSchema: Joi.ObjectSchema = this.schema
  ): Record<string, AWSDDB.AttributeValue> {
    return Object.entries(userObj).reduce((dynamoObj, [key, userValue]) => {
      const itemSchema = getItemSchemaFromObjectSchema(objectSchema, key);
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

  serialize(userObj: PlainObject, objectSchema?: Joi.ObjectSchema) {
    const versionedObject = {
      ...userObj,
      _v: this.version,
    };
    return this.toDynamoMap(versionedObject, objectSchema);
  }
}

export default Serializer;
