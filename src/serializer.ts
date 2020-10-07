import AWS from "aws-sdk";
import { PlainObject } from "./types";

type DynamoType = keyof AWS.DynamoDB.AttributeValue;

function fromDynamoValue(attributeValue: AWS.DynamoDB.AttributeValue): any {
  const [dynamoType, dynamoValue] = Object.entries(attributeValue)[0] as [
    DynamoType,
    any
  ];
  switch (dynamoType) {
    case "S": {
      return dynamoValue;
    }
    case "N": {
      return parseFloat(dynamoValue);
    }
    case "SS": {
      return dynamoValue as string[];
    }
    case "M": {
      return fromDynamoMap(dynamoValue as AWS.DynamoDB.AttributeMap);
    }
    case "NULL": {
      return null;
    }
    case "BOOL": {
      return dynamoValue;
    }
    default: {
      throw new Error(`Unsupported dynamodb type: ${dynamoType}`);
    }
  }
}

export function fromDynamoMap(dbObj: AWS.DynamoDB.AttributeMap): PlainObject {
  return Object.entries(dbObj).reduce((userObj, [key, attributeValue]) => {
    const userValue = fromDynamoValue(attributeValue);
    return {
      ...userObj,
      [key]: userValue,
    };
  }, {});
}

const USER_TO_DYNAMO = {
  string(value: string): AWS.DynamoDB.AttributeValue {
    return { S: value };
  },
  number(value: number): AWS.DynamoDB.AttributeValue {
    return { N: value.toString() };
  },
  boolean(value: boolean): AWS.DynamoDB.AttributeValue {
    return { BOOL: value };
  },
  object(o: PlainObject): AWS.DynamoDB.AttributeValue | undefined {
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
      M: toDynamoMap(o),
    };
  },
  array(
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
  },
};

type MapFunction = (value: any) => AWS.DynamoDB.AttributeValue | undefined;

export function toDynamoValue(
  userValue: any
): AWS.DynamoDB.AttributeValue | undefined {
  const type = typeof userValue;
  if (
    type === "bigint" ||
    type === "symbol" ||
    type === "undefined" ||
    type === "function"
  ) {
    throw new Error(`Cannot serialize ${type} to DynamoDB`);
  }
  const mapper: MapFunction = USER_TO_DYNAMO[type].bind(USER_TO_DYNAMO);
  return mapper(userValue);
}

export function toDynamoMap(userObj: PlainObject): AWS.DynamoDB.AttributeMap {
  return Object.entries(userObj).reduce((dynamoObj, [key, userValue]) => {
    const dynamoValue = toDynamoValue(userValue);
    if (dynamoValue === undefined) {
      return dynamoObj;
    }
    return {
      ...dynamoObj,
      [key]: dynamoValue,
    };
  }, {});
}
