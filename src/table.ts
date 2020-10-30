import AWS from "aws-sdk";

import Serializer from "./serializer";
import Deserializer from "./deserializer";

import type { PlainObject, Options } from "./types";

export default class Table {
  private dynamoDB: AWS.DynamoDB;
  private serializer: Serializer;
  private deserializer: Deserializer;
  name: string;

  constructor(private options: Options) {
    const config: AWS.DynamoDB.ClientConfiguration = {
      apiVersion: "2012-08-10",
      accessKeyId: process.env.OMANYD_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.OMANYD_AWS_SECRET_ACCESS_KEY,
      region: process.env.OMANYD_AWS_REGION,
    };
    if (process.env.DYNAMODB_URL) {
      config.endpoint = process.env.DYNAMODB_URL;
    }
    this.dynamoDB = new AWS.DynamoDB(config);
    this.name = options.name;
    this.serializer = new Serializer(options.schema);
    this.deserializer = new Deserializer(options.schema);
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

    let attributeDefinitions: AWS.DynamoDB.AttributeDefinitions = [
      { AttributeName: this.options.hashKey, AttributeType: "S" },
    ];

    if (this.options.indexes) {
      const indexDefinitions = this.options.indexes.map((index) => ({
        AttributeName: index.hashKey,
        AttributeType: "S",
      }));
      attributeDefinitions = attributeDefinitions.concat(indexDefinitions);
    }

    const keySchema: AWS.DynamoDB.KeySchema = [
      { AttributeName: this.options.hashKey, KeyType: "HASH" },
    ];
    if (this.options.rangeKey) {
      keySchema.push({
        AttributeName: this.options.rangeKey,
        KeyType: "RANGE",
      });
      attributeDefinitions.push({
        AttributeName: this.options.rangeKey,
        AttributeType: "S",
      });
    }

    const config: AWS.DynamoDB.CreateTableInput = {
      TableName: this.options.name,
      AttributeDefinitions: attributeDefinitions,
      KeySchema: keySchema,
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

  async create(obj: PlainObject): Promise<PlainObject> {
    const serializedItem = this.serializer.toDynamoMap(obj);
    return new Promise((res, rej) => {
      this.dynamoDB.putItem(
        {
          TableName: this.options.name,
          Item: serializedItem,
        },
        (err, data) => {
          if (err) {
            return rej(err);
          }
          // Serializing can drop undefined fields so return the deserialized serialized item
          return res(this.deserializer.fromDynamoMap(serializedItem));
        }
      );
    });
  }

  async getByHashKey(hashKey: string): Promise<PlainObject | null> {
    return new Promise((res, rej) => {
      this.dynamoDB.getItem(
        {
          TableName: this.options.name,
          ConsistentRead: true,
          Key: {
            [this.options.hashKey]: this.serializer.toDynamoValue(
              hashKey,
              this.options.schema[this.options.hashKey]
            )!,
          },
        },
        (err, data) => {
          if (err) {
            return rej(err);
          }
          if (!data.Item) {
            return res(null);
          }

          return res(this.deserializer.fromDynamoMap(data.Item));
        }
      );
    });
  }

  async getByHashAndRangeKey(
    hashKey: string,
    rangeKey: string
  ): Promise<Object | null> {
    return new Promise((res, rej) => {
      this.dynamoDB.getItem(
        {
          TableName: this.options.name,
          ConsistentRead: true,
          Key: {
            [this.options.hashKey]: this.serializer.toDynamoValue(
              hashKey,
              this.options.schema[this.options.hashKey]
            )!,
            [this.options.rangeKey!]: this.serializer.toDynamoValue(
              rangeKey,
              this.options.schema[this.options.rangeKey!]
            )!,
          },
        },
        (err, data) => {
          if (err) {
            return rej(err);
          }
          if (!data.Item) {
            return res(null);
          }

          return res(this.deserializer.fromDynamoMap(data.Item));
        }
      );
    });
  }

  async getByIndex(name: string, hashKey: string): Promise<PlainObject | null> {
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
            ":hashKey": this.serializer.toDynamoValue(
              hashKey,
              this.options.schema[this.options.hashKey]
            )!,
          },
        },
        (err, data) => {
          if (err) {
            return rej(err);
          }
          if (!data.Items || data.Items.length === 0) {
            return res(null);
          }
          return res(this.deserializer.fromDynamoMap(data.Items[0]));
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
                const converted = this.deserializer.fromDynamoMap(item);
                return converted;
              })
            );
          }
        );
    });
  }
}
