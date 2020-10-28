import { PlainObject, Schema } from "./types";

type DynamoType = keyof AWS.DynamoDB.AttributeValue;

class Deserializer {
  constructor(private schema: Schema) {}

  fromDynamoValue(attributeValue: AWS.DynamoDB.AttributeValue): any {
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
        return (dynamoValue as AWS.DynamoDB.AttributeValue[]).map((item) =>
          this.fromDynamoValue(item)
        );
      }
      case "M": {
        return this.fromDynamoMap(dynamoValue as AWS.DynamoDB.AttributeMap);
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

  fromDynamoMap(dbObj: AWS.DynamoDB.AttributeMap): PlainObject {
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
