import AWS from "aws-sdk";

import Serializer from "./serializer";
import Deserializer from "./deserializer";
import { getItemSchemaFromObjectSchema } from "./joiReflection";

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
    this.deserializer = new Deserializer();
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

  async getByHashKey(hashKeyValue: string): Promise<PlainObject | null> {
    return new Promise((res, rej) => {
      this.dynamoDB.getItem(
        {
          TableName: this.options.name,
          ConsistentRead: true,
          Key: {
            [this.options.hashKey]: this.serializer.toDynamoValue(
              hashKeyValue,
              getItemSchemaFromObjectSchema(
                this.options.schema,
                this.options.hashKey
              )
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
    hashKeyValue: string,
    rangeKeyValue: string
  ): Promise<Object | null> {
    const { rangeKey, hashKey } = this.options;

    return new Promise((res, rej) => {
      this.dynamoDB.getItem(
        {
          TableName: this.options.name,
          ConsistentRead: true,
          Key: {
            [this.options.hashKey]: this.serializer.toDynamoValue(
              hashKeyValue,
              getItemSchemaFromObjectSchema(this.options.schema, hashKey)
            )!,
            [this.options.rangeKey!]: this.serializer.toDynamoValue(
              rangeKeyValue,
              // Range key is guaranteed by check in store
              getItemSchemaFromObjectSchema(this.options.schema, rangeKey!)
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

  async getByIndex(
    indexName: string,
    value: string
  ): Promise<PlainObject | null> {
    const indexDefintion = (this.options.indexes ?? []).find(
      (index) => index.name === indexName
    );
    if (!indexDefintion) {
      throw new Error(`No index found with name: '${indexName}'`);
    }
    return new Promise((res, rej) => {
      this.dynamoDB.query(
        {
          TableName: this.options.name,
          IndexName: indexDefintion.name,
          KeyConditionExpression: `${indexDefintion.hashKey} = :hashKey`,
          ExpressionAttributeValues: {
            ":hashKey": this.serializer.toDynamoValue(
              value,
              getItemSchemaFromObjectSchema(
                this.options.schema,
                indexDefintion.hashKey
              )
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

  async deleteByHashKey(hashKeyValue: string): Promise<void> {
    const { hashKey } = this.options;
    return new Promise((res, rej) => {
      this.dynamoDB.deleteItem(
        {
          TableName: this.options.name,
          Key: {
            [this.options.hashKey]: this.serializer.toDynamoValue(
              hashKeyValue,
              getItemSchemaFromObjectSchema(this.options.schema, hashKey)
            )!,
          },
        },
        (err, data) => {
          if (err) {
            return rej(err);
          }
          return res();
        }
      );
    });
  }
}
