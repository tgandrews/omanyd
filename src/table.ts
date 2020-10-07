import AWS from "aws-sdk";

import { fromDynamoMap, toDynamoMap, toDynamoValue } from "./serializer";
import { PlainObject } from "./types";

interface InternalTableDefinition {
  name: string;
  hashKeyName: string;
}

export default class Table {
  private dynamoDB: AWS.DynamoDB;

  constructor(private definition: InternalTableDefinition) {
    const config: AWS.DynamoDB.ClientConfiguration = {
      apiVersion: "2012-08-10",
    };
    if (process.env.DYNAMODB_URL) {
      config.endpoint = process.env.DYNAMODB_URL;
    }
    this.dynamoDB = new AWS.DynamoDB(config);
  }

  async createTable(): Promise<AWS.DynamoDB.CreateTableOutput> {
    return new Promise((res, rej) => {
      this.dynamoDB.createTable(
        {
          TableName: this.definition.name,
          AttributeDefinitions: [
            { AttributeName: this.definition.hashKeyName, AttributeType: "S" },
          ],
          KeySchema: [
            { AttributeName: this.definition.hashKeyName, KeyType: "HASH" },
          ],
          // Should only be used in tests
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
        },
        (err, data) => {
          if (err) {
            return rej(err);
          }
          return res(data);
        }
      );
    });
  }

  async deleteTable(): Promise<AWS.DynamoDB.DeleteTableOutput> {
    return new Promise((res, rej) => {
      this.dynamoDB.deleteTable(
        {
          TableName: this.definition.name,
        },
        (err, data) => {
          if (err) {
            return rej(err);
          }
          return res(data);
        }
      );
    });
  }

  async tableExists(): Promise<boolean> {
    return new Promise((res, rej) => {
      this.dynamoDB.describeTable(
        { TableName: this.definition.name },
        (err, data) => {
          if (err && err.code !== "ResourceNotFoundException") {
            rej(err);
          }
          res(!!data);
        }
      );
    });
  }

  async create(obj: PlainObject): Promise<AWS.DynamoDB.PutItemOutput> {
    return new Promise((res, rej) => {
      this.dynamoDB.putItem(
        {
          TableName: this.definition.name,
          Item: toDynamoMap(obj),
        },
        (err, data) => {
          if (err) {
            return rej(err);
          }
          return res(data);
        }
      );
    });
  }

  async getByHashKey(hashKey: string): Promise<Object | null> {
    return new Promise((res, rej) => {
      this.dynamoDB.getItem(
        {
          TableName: this.definition.name,
          ConsistentRead: true,
          Key: {
            [this.definition.hashKeyName]: toDynamoValue(hashKey)!,
          },
        },
        (err, data) => {
          if (err) {
            return rej(err);
          }
          if (!data.Item) {
            return res(null);
          }

          return res(fromDynamoMap(data.Item));
        }
      );
    });
  }

  async scan(): Promise<Object[]> {
    return new Promise((res, rej) => {
      this,
        this.dynamoDB.scan(
          {
            TableName: this.definition.name,
            ConsistentRead: true,
          },
          (err, data) => {
            if (err) {
              return rej(err);
            }
            return res(
              data.Items!.map((item) => {
                const converted = fromDynamoMap(item);
                return converted;
              })
            );
          }
        );
    });
  }
}
