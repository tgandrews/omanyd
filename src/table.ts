import AWS from "aws-sdk";

import { fromDynamoMap, toDynamoMap, toDynamoValue } from "./serializer";
import type { PlainObject, Options } from "./types";

export default class Table {
  private dynamoDB: AWS.DynamoDB;

  constructor(private options: Options) {
    const config: AWS.DynamoDB.ClientConfiguration = {
      apiVersion: "2012-08-10",
    };
    if (process.env.DYNAMODB_URL) {
      config.endpoint = process.env.DYNAMODB_URL;
    }
    this.dynamoDB = new AWS.DynamoDB(config);
  }

  async createTable(): Promise<AWS.DynamoDB.CreateTableOutput> {
    const globalSecondaryIndexes: AWS.DynamoDB.GlobalSecondaryIndexList = (
      this.options.indexes ?? []
    )
      .filter((index) => index.type === "global")
      .map((index) => ({
        IndexName: index.name,
        KeySchema: [
          {
            AttributeName: index.hashKey,
            KeyType: "HASH",
          },
        ],
        Projection: {
          ProjectionType: "ALL",
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 1,
          WriteCapacityUnits: 1,
        },
      }));

    const additionalAttributeDefinitionsForIndexes = (
      this.options.indexes ?? []
    ).map((index) => ({
      AttributeName: index.hashKey,
      AttributeType: "S",
    }));

    const config: AWS.DynamoDB.CreateTableInput = {
      TableName: this.options.name,
      AttributeDefinitions: [
        { AttributeName: this.options.hashKey, AttributeType: "S" },
        ...additionalAttributeDefinitionsForIndexes,
      ],
      KeySchema: [{ AttributeName: this.options.hashKey, KeyType: "HASH" }],
      // Should only be used in tests
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
      GlobalSecondaryIndexes:
        globalSecondaryIndexes.length === 0
          ? undefined
          : globalSecondaryIndexes,
    };

    return new Promise((res, rej) => {
      this.dynamoDB.createTable(config, (err, data) => {
        if (err) {
          return rej(err);
        }
        return res(data);
      });
    });
  }

  async deleteTable(): Promise<AWS.DynamoDB.DeleteTableOutput> {
    return new Promise((res, rej) => {
      this.dynamoDB.deleteTable(
        {
          TableName: this.options.name,
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
        { TableName: this.options.name },
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
          TableName: this.options.name,
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
          TableName: this.options.name,
          ConsistentRead: true,
          Key: {
            [this.options.hashKey]: toDynamoValue(hashKey)!,
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

  async getByIndex(name: string, hashKey: string): Promise<Object | null> {
    const indexDefintion = (this.options.indexes ?? []).find(
      (index) => index.name === name
    );
    if (!indexDefintion) {
      throw new Error(`No index found with name: '${name}'`);
    }
    return new Promise((res, rej) => {
      this.dynamoDB.query(
        {
          TableName: this.options.name,
          IndexName: indexDefintion.name,
          KeyConditionExpression: `${indexDefintion.hashKey} = :hashKey`,
          ExpressionAttributeValues: {
            ":hashKey": toDynamoValue(hashKey)!,
          },
        },
        (err, data) => {
          if (err) {
            return rej(err);
          }
          if (!data.Items || data.Items.length === 0) {
            return res(null);
          }
          return res(fromDynamoMap(data.Items[0]));
        }
      );
    });
  }

  async scan(): Promise<Object[]> {
    return new Promise((res, rej) => {
      this,
        this.dynamoDB.scan(
          {
            TableName: this.options.name,
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
