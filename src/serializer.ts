import AWS from "aws-sdk";
import { PlainObject, Schema } from "./types";

type MapFunction = (value: any) => AWS.DynamoDB.AttributeValue | undefined;

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

  private object(o: PlainObject): AWS.DynamoDB.AttributeValue | undefined {
    if (o === null) {
      return { NULL: true };
    }
    if (Array.isArray(o)) {
      if (o.length === 0) {
        return undefined;
      }
      return this.array(o);
    }
    if (o instanceof Buffer) {
      throw new Error("Buffers not yet supported yet");
    }
    return {
      M: this.toDynamoMap(o),
    };
  }

  private array(
    a: any[]
  ): {
    SS: AWS.DynamoDB.StringSetAttributeValue;
  } {
    // TODO: Replace this with looking at the schema definition
    const first = a[0];
    switch (typeof first) {
      case "string": {
        return { SS: a };
      }
      default: {
        throw new Error(`Unexpected type in array: ${typeof first}`);
      }
    }
  }

  toDynamoValue(userValue: any): AWS.DynamoDB.AttributeValue | undefined {
    const type = typeof userValue;
    if (
      type === "bigint" ||
      type === "symbol" ||
      type === "undefined" ||
      type === "function"
    ) {
      throw new Error(`Cannot serialize ${type} to DynamoDB`);
    }
    const mapper: MapFunction = this[type].bind(this);
    return mapper(userValue);
  }

  toDynamoMap(userObj: PlainObject): AWS.DynamoDB.AttributeMap {
    return Object.entries(userObj).reduce((dynamoObj, [key, userValue]) => {
      const dynamoValue = this.toDynamoValue(userValue);
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
