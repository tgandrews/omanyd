import * as AWSDDB from "@aws-sdk/client-dynamodb";
import Serializer from "./serializer";
import Deserializer from "./deserializer";
import { getItemSchemaFromObjectSchema } from "./joiReflection";

import type { PlainObject, Options } from "./types";

export default class Table {
  private dynamoDB: AWSDDB.DynamoDBClient;
  private serializer: Serializer;
  private deserializer: Deserializer;
  name: string;

  constructor(private options: Options) {
    const config: AWSDDB.DynamoDBClientConfig = {
      region: process.env.OMANYD_AWS_REGION,
    };

    const accessKeyId = process.env.OMANYD_AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.OMANYD_AWS_SECRET_ACCESS_KEY;
    if (accessKeyId || secretAccessKey) {
      if (!accessKeyId) {
        throw new Error("Found secret access key but not access key id");
      }
      if (!secretAccessKey) {
        throw new Error("Found access key id but not secret access key");
      }
      config.credentials = {
        secretAccessKey,
        accessKeyId,
      };
    }
    if (process.env.DYNAMODB_URL) {
      config.endpoint = process.env.DYNAMODB_URL;
    }

    this.dynamoDB = new AWSDDB.DynamoDBClient(config);
    this.name = options.name;
    this.serializer = new Serializer(options.schema);
    this.deserializer = new Deserializer();
  }

  async createTable(): Promise<AWSDDB.CreateTableOutput> {
    const globalSecondaryIndexes: AWSDDB.GlobalSecondaryIndex[] = (
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
          ...(index.sortKey
            ? [{ AttributeName: index.sortKey, KeyType: "RANGE" }]
            : []),
        ],
        Projection: {
          ProjectionType: "ALL",
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 1,
          WriteCapacityUnits: 1,
        },
      }));

    let attributeDefinitions: AWSDDB.AttributeDefinition[] = [
      { AttributeName: this.options.hashKey, AttributeType: "S" },
    ];

    if (this.options.indexes) {
      const indexDefinitions = this.options.indexes.flatMap((index) => {
        const indexDefinitions = [
          {
            AttributeName: index.hashKey,
            AttributeType: "S",
          },
        ];
        if (index.sortKey) {
          indexDefinitions.push({
            AttributeName: index.sortKey,
            AttributeType: "S",
          });
        }
        return indexDefinitions;
      });
      attributeDefinitions = attributeDefinitions.concat(indexDefinitions);
    }

    const keySchema: AWSDDB.KeySchemaElement[] = [
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

    const config: AWSDDB.CreateTableInput = {
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

    return this.dynamoDB.send(new AWSDDB.CreateTableCommand(config));
  }

  async deleteTable(): Promise<AWSDDB.DeleteTableOutput> {
    return this.dynamoDB.send(
      new AWSDDB.DeleteTableCommand({
        TableName: this.options.name,
      })
    );
  }

  async tableExists(): Promise<boolean> {
    try {
      const data = await this.dynamoDB.send(
        new AWSDDB.DescribeTableCommand({
          TableName: this.options.name,
        })
      );
      return Boolean(data.Table);
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "name" in err &&
        err.name === "ResourceNotFoundException"
      ) {
        return false;
      }
      throw err;
    }
  }

  async create(obj: PlainObject): Promise<PlainObject> {
    const serializedItem = this.serializer.toDynamoMap(obj);
    await this.dynamoDB.send(
      new AWSDDB.PutItemCommand({
        TableName: this.options.name,
        Item: serializedItem,
      })
    );
    return this.deserializer.fromDynamoMap(serializedItem);
  }

  async getByHashKey(hashKeyValue: string): Promise<PlainObject | null> {
    const result = await this.dynamoDB.send(
      new AWSDDB.GetItemCommand({
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
      })
    );
    if (!result.Item) {
      return null;
    }

    return this.deserializer.fromDynamoMap(result.Item);
  }

  async getByHashAndRangeKey(
    hashKeyValue: string,
    rangeKeyValue: string
  ): Promise<PlainObject | null> {
    const { rangeKey, hashKey } = this.options;

    const result = await this.dynamoDB.send(
      new AWSDDB.GetItemCommand({
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
      })
    );

    if (!result.Item) {
      return null;
    }

    return this.deserializer.fromDynamoMap(result.Item);
  }

  async getAllByHashKey(hashKeyValue: string): Promise<PlainObject[]> {
    const { hashKey, schema, name } = this.options;

    const result = await this.dynamoDB.send(
      new AWSDDB.QueryCommand({
        TableName: name,
        ConsistentRead: true,
        ExpressionAttributeValues: {
          ":h": this.serializer.toDynamoValue(
            hashKeyValue,
            getItemSchemaFromObjectSchema(schema, hashKey)
          )!,
        },
        KeyConditionExpression: `${hashKey} = :h`,
      })
    );

    if (!result.Items) {
      throw new Error("No Items found in get all result");
    }

    return result.Items!.map((i) => this.deserializer.fromDynamoMap(i));
  }

  async getByIndex(
    indexName: string,
    hashKey: string,
    sortKey?: string
  ): Promise<PlainObject | null> {
    const indexDefintion = (this.options.indexes ?? []).find(
      (index) => index.name === indexName
    );
    if (!indexDefintion) {
      throw new Error(`No index found with name: '${indexName}'`);
    }
    if (sortKey && !indexDefintion.sortKey) {
      throw new Error("Index does not have a sort key but one was provided");
    }

    const keyConditionExpression = [`${indexDefintion.hashKey} = :hashKey`];
    if (sortKey) {
      keyConditionExpression.push(`${indexDefintion.sortKey} = :sortKey`);
    }

    const queryCommandInput: AWSDDB.QueryCommandInput = {
      TableName: this.options.name,
      IndexName: indexDefintion.name,
      KeyConditionExpression: keyConditionExpression.join(" AND "),
      ExpressionAttributeValues: {
        ":hashKey": this.serializer.toDynamoValue(
          hashKey,
          getItemSchemaFromObjectSchema(
            this.options.schema,
            indexDefintion.hashKey
          )
        )!,
      },
    };

    if (indexDefintion.sortKey) {
      queryCommandInput.ExpressionAttributeValues![":sortKey"] =
        this.serializer.toDynamoValue(
          sortKey,
          getItemSchemaFromObjectSchema(
            this.options.schema,
            indexDefintion.sortKey!
          )
        )!;
    }

    const result = await this.dynamoDB.send(
      new AWSDDB.QueryCommand(queryCommandInput)
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }
    return this.deserializer.fromDynamoMap(result.Items[0]);
  }

  async scan(): Promise<Object[]> {
    const result = await this.dynamoDB.send(
      new AWSDDB.ScanCommand({
        TableName: this.options.name,
        ConsistentRead: true,
      })
    );

    if (!result.Items) {
      throw new Error("No items returned in scan result");
    }

    return result.Items.map((item) => {
      const converted = this.deserializer.fromDynamoMap(item);
      return converted;
    });
  }

  async deleteByHashKey(hashKeyValue: string): Promise<void> {
    const { hashKey } = this.options;

    await this.dynamoDB.send(
      new AWSDDB.DeleteItemCommand({
        TableName: this.options.name,
        Key: {
          [this.options.hashKey]: this.serializer.toDynamoValue(
            hashKeyValue,
            getItemSchemaFromObjectSchema(this.options.schema, hashKey)
          )!,
        },
      })
    );
  }
}
