import * as AWSDDB from "@aws-sdk/client-dynamodb";

import { PlainObject } from "./types";

type DynamoType = keyof AWSDDB.AttributeValue;
type AttributeMap = Record<string, AWSDDB.AttributeValue>;

class Deserializer {
  fromDynamoValue(attributeValue: AWSDDB.AttributeValue): any {
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
      case "L": {
        return (dynamoValue as AWSDDB.AttributeValue[]).map((item) =>
          this.fromDynamoValue(item)
        );
      }
      case "M": {
        return this.fromDynamoMap(dynamoValue as AttributeMap);
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

  fromDynamoMap(dbObj: AttributeMap): PlainObject {
    return Object.entries(dbObj).reduce((userObj, [key, attributeValue]) => {
      const userValue = this.fromDynamoValue(attributeValue);
      return {
        ...userObj,
        [key]: userValue,
      };
    }, {});
  }
}

export default Deserializer;
