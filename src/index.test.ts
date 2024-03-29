import Joi from "joi";
import Omanyd from "./";

describe("omanyd", () => {
  afterAll(async () => {
    await Omanyd.deleteTables();
  });

  describe("basic read/write", () => {
    it("should allow for a basic item to be saved/read", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "basic",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({ value: "hello world" });

      expect(savedThing.id).toBeDefined();

      const readThing = await ThingStore.getByHashKey(savedThing.id);

      expect(savedThing).toEqual(readThing);
    });

    it("should return null if the item is not found", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "basicNotFound",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      const readThing = await ThingStore.getByHashKey("some missing id");

      expect(readThing).toBeNull();
    });

    it("should allow for a numbers to saved and read", async () => {
      interface Thing {
        id: string;
        value: number;
        value2: number;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "basicNumber",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.number().required(),
          value2: Joi.number().required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({ value: 1.23, value2: 5000 });

      expect(savedThing.id).toBeDefined();

      const readThing = await ThingStore.getByHashKey(savedThing.id);

      expect(savedThing).toEqual(readThing);
    });

    it("should allow for a booleans to saved and read", async () => {
      interface Thing {
        id: string;
        value: boolean;
        value2: boolean;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "basicBoolean",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.boolean().required(),
          value2: Joi.boolean().required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({
        value: true,
        value2: false,
      });

      expect(savedThing.id).toBeDefined();

      const readThing = await ThingStore.getByHashKey(savedThing.id);

      expect(savedThing).toEqual(readThing);
    });

    it("should allow nested objects to be saved and read", async () => {
      interface Thing {
        id: string;
        value: {
          key1: string;
          key2: number;
          key3: string[];
        };
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "basicObject",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.object({
            key1: Joi.string().required(),
            key2: Joi.number().required(),
            key3: Omanyd.types.stringSet().required(),
          }).required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({
        value: {
          key1: "hello",
          key2: 234,
          key3: ["this", "will", "do"].sort(),
        },
      });

      expect(savedThing.id).toBeDefined();
      expect(savedThing).toEqual({
        id: expect.any(String),
        value: {
          key1: "hello",
          key2: 234,
          key3: ["this", "will", "do"].sort(),
        },
      });

      const readThing = await ThingStore.getByHashKey(savedThing.id);

      expect(savedThing).toEqual(readThing);
    });

    it("should allow for null values to be saved and read", async () => {
      interface Thing {
        id: string;
        value: null;
        value2: number;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "basicNull",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.any(),
          value2: Joi.number().required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({
        value: null,
        value2: 5678,
      });

      expect(savedThing.id).toBeDefined();
      expect(savedThing).toEqual({
        id: expect.any(String),
        value: null,
        value2: 5678,
      });

      const readThing = await ThingStore.getByHashKey(savedThing.id);

      expect(savedThing).toEqual(readThing);
    });

    it("should allow for updating an item", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "basicUpdating",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({ value: "hello world" });

      savedThing.value = "a new world";

      await ThingStore.put(savedThing);

      const readThing = await ThingStore.getByHashKey(savedThing.id);

      expect(savedThing).toEqual(readThing);
    });

    it("should not error with objects containing undefined", async () => {
      interface Thing {
        id: string;
        value?: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "basicUndefined",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({ value: undefined });

      expect(savedThing).toStrictEqual({
        id: savedThing.id,
      });
    });

    it("should save and return empty arrays", async () => {
      interface Thing {
        id: string;
        list: string[];
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "basicEmptyArray",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          list: Joi.array().items(Joi.string()).default([]),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({ list: [] });
      expect(savedThing.list).toEqual([]);
    });

    it("should save and return date objects", async () => {
      interface Thing {
        id: string;
        date: Date;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "basicDate",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          date: Joi.date(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({
        date: new Date("2023-03-02T11:49:00.000Z"),
      });
      const readThing = await ThingStore.getByHashKey(savedThing.id);
      expect(savedThing.date).toBeInstanceOf(Date);
      expect(savedThing.date).toEqual(new Date("2023-03-02T11:49:00.000Z"));
      expect(readThing?.date).toBeInstanceOf(Date);
      expect(readThing?.date).toEqual(new Date("2023-03-02T11:49:00.000Z"));
    });

    it("should save and return dates nested within objects", async () => {
      interface Thing {
        id: string;
        a: {
          b: {
            date: Date;
          };
        };
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "nestedDate",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          a: Joi.object({
            b: Joi.object({
              date: Joi.date().required(),
            }).required(),
          }).required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({
        a: {
          b: {
            date: new Date("2023-03-02T11:49:00.000Z"),
          },
        },
      });
      const readThing = await ThingStore.getByHashKey(savedThing.id);
      expect(savedThing.a.b.date).toBeInstanceOf(Date);
      expect(savedThing.a.b.date).toEqual(new Date("2023-03-02T11:49:00.000Z"));
      expect(readThing?.a.b.date).toBeInstanceOf(Date);
      expect(readThing?.a.b.date).toEqual(new Date("2023-03-02T11:49:00.000Z"));
    });

    it("should save and return dates nested within arrays", async () => {
      interface Thing {
        id: string;
        list: {
          date: Date;
        }[];
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "arrayNestedDate",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          list: Joi.array()
            .items(
              Joi.object({
                date: Joi.date().required(),
              }).required()
            )
            .required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({
        list: [
          {
            date: new Date("2023-03-02T11:49:00.000Z"),
          },
        ],
      });
      const readThing = await ThingStore.getByHashKey(savedThing.id);
      expect(savedThing.list[0].date).toBeInstanceOf(Date);
      expect(savedThing.list[0].date).toEqual(
        new Date("2023-03-02T11:49:00.000Z")
      );
      expect(readThing?.list[0].date).toBeInstanceOf(Date);
      expect(readThing?.list[0].date).toEqual(
        new Date("2023-03-02T11:49:00.000Z")
      );
    });

    it("should save and return arrays with no schema", async () => {
      interface Thing {
        id: string;
        list: number[];
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "arraysOfNumbers",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          list: Joi.array().required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({
        list: [123, 456, 789],
      });
      const readThing = await ThingStore.getByHashKey(savedThing.id);
      expect(savedThing.list).toStrictEqual([123, 456, 789]);
      expect(readThing?.list).toStrictEqual([123, 456, 789]);
    });
  });

  describe("range key", () => {
    it("should allow for an item to be read when using range key", async () => {
      interface Thing {
        id: string;
        version: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "basicRangeKey",
        hashKey: "id",
        rangeKey: "version",
        schema: Joi.object({
          id: Joi.string().required(),
          version: Joi.string().required(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      const [savedThing1, savedThing2] = await Promise.all([
        ThingStore.create({ id: "id", version: "1", value: "hello world" }),
        ThingStore.create({ id: "id", version: "2", value: "hello world" }),
      ]);

      const readThing = await ThingStore.getByHashAndRangeKey("id", "2");

      expect(readThing).not.toStrictEqual(savedThing1);
      expect(readThing).toStrictEqual(savedThing2);
    });

    it("should not find an object that does not exist", async () => {
      interface Thing {
        id: string;
        version: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "rangeKeyItemNotFound",
        hashKey: "id",
        rangeKey: "version",
        schema: Joi.object({
          id: Joi.string().required(),
          version: Joi.string().required(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      const readThing = await ThingStore.getByHashAndRangeKey("id", "2");

      expect(readThing).toBeNull();
    });

    it("should error if a user attempts to read by range key but it is not defined in the schema", async () => {
      interface Thing {
        id: string;
        version: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "noRangeKeyError",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          version: Joi.string().required(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      await expect(
        async () => await ThingStore.getByHashAndRangeKey("id", "2")
      ).rejects.toThrow(/no defined range key/i);
    });

    it("should return all items for a hash key and if there are multiple items", async () => {
      interface Thing {
        id: string;
        version: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "rangeKeyMultipleRead",
        hashKey: "id",
        rangeKey: "version",
        schema: Joi.object({
          id: Joi.string().required(),
          version: Joi.string().required(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      const [savedThing1, savedThing2] = await Promise.all([
        ThingStore.create({ id: "id", version: "1", value: "hello world 1" }),
        ThingStore.create({ id: "id", version: "2", value: "hello world 2" }),
      ]);

      const readThings = await ThingStore.getAllByHashKey("id");

      expect(readThings).toStrictEqual([savedThing1, savedThing2]);
    });

    it("should return all items for a hash key - finds none", async () => {
      interface Thing {
        id: string;
        version: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "rangeKeyMultipleReadNotFound",
        hashKey: "id",
        rangeKey: "version",
        schema: Joi.object({
          id: Joi.string().required(),
          version: Joi.string().required(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      const readThings = await ThingStore.getAllByHashKey("id");

      expect(readThings).toStrictEqual([]);
    });
  });

  describe("validation", () => {
    it("should reject objects containing functions", async () => {
      interface Thing {
        id: string;
        value: Function;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "errorFunction",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.any().required(),
        }),
      });

      await Omanyd.createTables();

      await expect(
        ThingStore.create({
          value: () => {
            return 1 + 1;
          },
        })
      ).rejects.toThrow(/Cannot serialize "function" to DynamoDB/);
    });

    it("should reject objects containing symbols", async () => {
      interface Thing {
        id: string;
        value: Symbol;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "errorSymbol",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.any().required(),
        }),
      });

      await Omanyd.createTables();

      await expect(
        ThingStore.create({
          value: Symbol("hi"),
        })
      ).rejects.toThrow(/Cannot serialize "symbol" to DynamoDB/);
    });

    it("should reject objects containing buffers", async () => {
      interface Thing {
        id: string;
        value: Buffer;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "errorBuffer",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.any().required(),
        }),
      });

      await Omanyd.createTables();

      await expect(
        ThingStore.create({
          value: Buffer.from("hello world", "utf-8"),
        })
      ).rejects.toThrow(/Buffers not yet supported/);
    });

    it("should reject items if they are not contained in the top level schema", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "errorMissingSchema",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      await expect(
        ThingStore.create({
          value: "hello world",
          wrongFieldName: "thing",
        } as any)
      ).rejects.toThrow(/"wrongFieldName" is not allowed/);
    });
  });

  describe("sets", () => {
    it("should allow for saving/reading of string sets", async () => {
      interface Thing {
        id: string;
        value: string[];
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "StringSet",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Omanyd.types.stringSet(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({
        value: ["hello", "world"],
      });

      expect(savedThing.id).toBeDefined();
      const readThing = await ThingStore.getByHashKey(savedThing.id);
      expect(readThing).toBeDefined();
      expect(readThing!.value).toEqual(["hello", "world"]);
    });

    it("should be able to save and read an empty set", async () => {
      interface Thing {
        id: string;
        value: string[];
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "setEmpty",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Omanyd.types.stringSet(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({
        value: [],
      });

      expect(savedThing.id).toBeDefined();
      const readThing = await ThingStore.getByHashKey(savedThing.id);
      expect(readThing).toBeDefined();
      expect(readThing!.value).toEqual([]);
    });
  });

  describe("lists", () => {
    it("should be able to save and read lists", async () => {
      interface Thing {
        id: string;
        value: any[];
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "listAny",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.array().items(Joi.any()).required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({
        value: [1, "hello", { foo: "bar" }, false, [1, 2]],
      });

      expect(savedThing.id).toBeDefined();
      const readThing = await ThingStore.getByHashKey(savedThing.id);
      expect(readThing).toBeDefined();
      expect(readThing!.value).toEqual([
        1,
        "hello",
        { foo: "bar" },
        false,
        [1, 2],
      ]);
    });

    it("should be able to update lists", async () => {
      interface Thing {
        id: string;
        value: any[];
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "listUpdating",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.array().items(Joi.any()).required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({
        value: [1, "hello", { foo: "bar" }],
      });
      await ThingStore.put({
        ...savedThing,
        value: savedThing.value.slice(0, 2),
      });

      const readThing = await ThingStore.getByHashKey(savedThing.id);
      expect(readThing).toBeDefined();
      expect(readThing!.value).toEqual([1, "hello"]);
    });
  });

  describe("scan", () => {
    it("should be able to return all of the items in a table", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "scanAll",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      const savedItems = await Promise.all([
        ThingStore.create({ value: "hello" }),
        ThingStore.create({ value: "world" }),
      ]);
      const [saved1, saved2] = savedItems;

      const readItems = await ThingStore.scan();
      // Have to sort as scan does not guarantee order
      readItems.sort((a, b) => {
        const aIndex = savedItems.findIndex((i) => i.id === a.id);
        const bIndex = savedItems.findIndex((i) => i.id === b.id);
        if (aIndex < bIndex) {
          return -1;
        } else {
          return 1;
        }
      });
      const [read1, read2] = readItems;
      expect(read1.value).toEqual(saved1.value);
      expect(read2.value).toEqual(saved2.value);
    });

    it("should return an empty array when nothing found", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "scanEmpty",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      const readItems = await ThingStore.scan();

      expect(readItems.length).toEqual(0);
    });
  });

  describe("index", () => {
    it("should be able to define and retrieve by that index", async () => {
      interface Thing {
        id: string;
        email: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "indexQuery",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          email: Joi.string().required(),
        }),
        indexes: [
          {
            name: "ValueIndex",
            type: "global",
            hashKey: "email",
          },
        ],
      });

      await Omanyd.createTables();

      const savedItem = await ThingStore.create({ email: "hello@world.com" });

      const readItem = await ThingStore.getByIndex(
        "ValueIndex",
        "hello@world.com"
      );

      expect(savedItem).toStrictEqual(readItem);
    });

    it("should return null if the item is not found", async () => {
      interface Thing {
        id: string;
        email: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "indexQueryNotFound",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          email: Joi.string().required(),
        }),
        indexes: [
          {
            name: "ValueIndex",
            type: "global",
            hashKey: "email",
          },
        ],
      });

      await Omanyd.createTables();

      const readItem = await ThingStore.getByIndex(
        "ValueIndex",
        "hello@world.com"
      );

      expect(readItem).toBeNull();
    });

    it("should throw if the index does not exist", async () => {
      interface Thing {
        id: string;
        email: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "indexNotDefined",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          email: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      await expect(
        ThingStore.getByIndex("ValueIndex", "hello@world.com")
      ).rejects.toThrow(/No index found with name: 'ValueIndex'/);
    });
  });

  describe("index with sort keys", () => {
    it("should be able to define and retrieve by that index", async () => {
      interface Thing {
        id: string;
        email: string;
        anotherField: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "indexSKQuery",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          email: Joi.string().required(),
          anotherField: Joi.string().required(),
        }),
        indexes: [
          {
            name: "ValueIndex",
            type: "global",
            hashKey: "email",
            sortKey: "anotherField",
          },
        ],
      });

      await Omanyd.createTables();

      const savedItem1 = await ThingStore.create({
        email: "hello@world.com",
        anotherField: "1",
      });
      const savedItem2 = await ThingStore.create({
        email: "hello@world.com",
        anotherField: "2",
      });

      const readItem1 = await ThingStore.getByIndex(
        "ValueIndex",
        "hello@world.com",
        "1"
      );

      const readItem2 = await ThingStore.getByIndex(
        "ValueIndex",
        "hello@world.com",
        "2"
      );

      expect(savedItem1).toStrictEqual(readItem1);
      expect(savedItem2).toStrictEqual(readItem2);

      expect(savedItem1).not.toStrictEqual(readItem2);
      expect(savedItem2).not.toStrictEqual(readItem1);
    });

    it("should return null if the item is not found", async () => {
      interface Thing {
        id: string;
        email: string;
        anotherField: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "indexSKQueryNotFound",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          email: Joi.string().required(),
          anotherField: Joi.string().required(),
        }),
        indexes: [
          {
            name: "ValueIndex",
            type: "global",
            hashKey: "email",
            sortKey: "anotherField",
          },
        ],
      });

      await Omanyd.createTables();

      const readItem = await ThingStore.getByIndex(
        "ValueIndex",
        "hello@world.com",
        "1"
      );

      expect(readItem).toBeNull();
    });

    it("should throw if the index does not exist", async () => {
      interface Thing {
        id: string;
        email: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "indexSKNotDefined",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          email: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      await expect(
        ThingStore.getByIndex("ValueIndex", "hello@world.com")
      ).rejects.toThrow(/No index found with name: 'ValueIndex'/);
    });

    it("should throw if the index does not have a sort key and one is provided", async () => {
      interface Thing {
        id: string;
        email: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "indexSKNotInIndez",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          email: Joi.string().required(),
        }),
        indexes: [
          {
            name: "ValueIndex",
            type: "global",
            hashKey: "email",
          },
        ],
      });

      await Omanyd.createTables();

      await expect(
        ThingStore.getByIndex("ValueIndex", "hello@world.com", "1")
      ).rejects.toThrow(/Index does not have a sort key but one was provided/);
    });
  });

  describe("clearTables", () => {
    it("should clear all the data in the existing tables", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "clearTables",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({ value: "hello world" });

      expect(savedThing).not.toBeNull();

      await Omanyd.clearTables();

      const readThing = await ThingStore.getByHashKey(savedThing.id);

      expect(readThing).toBeNull();
    });
  });

  describe("multiple table defintions", () => {
    it("should error when defining two stores for the same table", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      Omanyd.define<Thing>({
        name: "multipleTablesError",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }),
      });
      expect(() => {
        Omanyd.define<Thing>({
          name: "multipleTablesError",
          hashKey: "id",
          schema: Joi.object({
            id: Omanyd.types.id(),
            value: Joi.string().required(),
          }),
        });
      }).toThrow(/clashing table name: "multipleTablesError"/);
    });

    it("should allow for a multiple table name to be defined multiple times ", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      Omanyd.define<Thing>({
        name: "multipleTablesSuccess",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }),
      });
      expect(() => {
        Omanyd.define<Thing>({
          name: "multipleTablesSuccess",
          hashKey: "id",
          schema: Joi.object({
            id: Omanyd.types.id(),
            value: Joi.string().required(),
            extras: Joi.array().items(Joi.string()),
          }),
          allowNameClash: true,
        });
      }).not.toThrow();
    });

    it("should allow for missing definitions", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "multipleTablesReadWrite",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }).unknown(true),
      });

      interface ExtendedThing extends Thing {
        extras: any[];
      }

      const ExtendedThingStore = Omanyd.define<ExtendedThing>({
        name: "multipleTablesReadWrite",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
          extras: Joi.array().items(Joi.any()),
        }),
        allowNameClash: true,
      });

      await Omanyd.createTables();

      const extendedThing = await ExtendedThingStore.create({
        value: "hello",
        extras: ["hello", 1],
      });

      const thing = await ThingStore.getByHashKey(extendedThing.id);

      expect(thing).toStrictEqual(extendedThing);
    });

    it("should be possible for an extended store to save a read value", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "multipleTablesReadWriteExtended",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }).unknown(true),
      });

      interface ExtendedThing extends Thing {
        extras: any[];
      }

      const ExtendedThingStore = Omanyd.define<ExtendedThing>({
        name: "multipleTablesReadWriteExtended",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
          extras: Joi.array().items(Joi.any()),
        }),
        allowNameClash: true,
      });

      await Omanyd.createTables();

      const extendedThing = await ExtendedThingStore.create({
        value: "hello",
        extras: ["hello", 1],
      });

      const thing = (await ThingStore.getByHashKey(
        extendedThing.id
      )) as unknown as Thing;
      thing.value = "goodbye";

      const updatedThing = await ThingStore.put(thing);

      expect(updatedThing).toStrictEqual({
        ...extendedThing,
        value: "goodbye",
      });
    });
  });

  describe("deletion", () => {
    it("should delete the item by hash key", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "deletionSimple",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({ value: "hello world" });

      expect(savedThing.id).toBeDefined();

      await ThingStore.deleteByHashKey(savedThing.id);

      const readThing = await ThingStore.getByHashKey(savedThing.id);

      expect(readThing).toBeNull();
    });

    it("should not error if the item is deleted as second time", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "deletionRepeated",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({ value: "hello world" });

      await ThingStore.deleteByHashKey(savedThing.id);
      await expect(
        ThingStore.deleteByHashKey(savedThing.id)
      ).resolves.toBeUndefined();
    });

    it("should not error if a non-existant id is provided", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "deletionNonExistant",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        }),
      });

      await Omanyd.createTables();

      await ThingStore.deleteByHashKey("non-existant-id");
    });
  });

  describe("versioning", () => {
    it("should automatically migrate between the old and new version on read", async () => {
      interface ThingV0 {
        id: string;
        value: string;
      }
      const v0Schema = Joi.object({
        id: Omanyd.types.id(),
        value: Joi.string().required(),
      });
      const v0Store = Omanyd.define<ThingV0>({
        name: "automaticallyMigrate",
        hashKey: "id",
        schema: v0Schema,
      });
      await Omanyd.createTables();
      const storedV0Thing = await v0Store.create({ value: "hello" });
      expect(storedV0Thing).toStrictEqual({
        id: storedV0Thing.id,
        value: "hello",
      });

      interface ThingV1 {
        id: string;
        value: string;
        extra: string;
      }
      const v1Store = Omanyd.define<ThingV1>({
        name: "automaticallyMigrate",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
          extra: Joi.string().required(),
        }),
        versions: [
          {
            schema: v0Schema,
            migrate: (thingV0: ThingV0): ThingV1 => {
              return {
                ...thingV0,
                extra: "default value",
              };
            },
          },
        ],
        // This wouldn't be needed in prod but needed here
        allowNameClash: true,
      });

      const readV1Item = await v1Store.getByHashKey(storedV0Thing.id);
      expect(readV1Item).toStrictEqual({
        id: storedV0Thing.id,
        value: "hello",
        extra: "default value",
      });
    });

    it("should only run the migrations needed", async () => {
      interface ThingV0 {
        id: string;
        value: string;
      }
      const v0Schema = Joi.object({
        id: Omanyd.types.id(),
        value: Joi.string().required(),
      });

      interface ThingV1 {
        id: string;
        value: string;
        extra: string;
      }
      const v0ToV1Migration = jest.fn((thingV0: ThingV0): ThingV1 => {
        return {
          ...thingV0,
          extra: "default value",
        };
      });
      const v1Schema = Joi.object({
        id: Omanyd.types.id(),
        value: Joi.string().required(),
        extra: Joi.string().required(),
      });
      const v1Store = Omanyd.define<ThingV1>({
        name: "automaticallyMigrateOnlyNeeded",
        hashKey: "id",
        schema: v1Schema,
        versions: [
          {
            schema: v0Schema,
            migrate: v0ToV1Migration,
          },
        ],
      });
      await Omanyd.createTables();
      const storedV1Thing = await v1Store.create({
        value: "hello",
        extra: "extra",
      });

      interface ThingV2 {
        id: string;
        value: string;
        extra: string;
        extra2: number;
      }
      const v1ToV2Migration = jest.fn((thingV1: ThingV1): ThingV2 => {
        return {
          ...thingV1,
          extra2: 5,
        };
      });
      const v2Store = Omanyd.define<ThingV1>({
        name: "automaticallyMigrateOnlyNeeded",
        hashKey: "id",
        schema: Joi.object({
          id: Omanyd.types.id(),
          value: Joi.string().required(),
          extra: Joi.string().required(),
          extra2: Joi.number().required(),
        }),
        versions: [
          {
            schema: v0Schema,
            migrate: v0ToV1Migration,
          },
          {
            schema: v1Schema,
            migrate: v1ToV2Migration,
          },
        ],
        allowNameClash: true,
      });

      const readV2Item = await v2Store.getByHashKey(storedV1Thing.id);
      expect(readV2Item).toStrictEqual({
        id: storedV1Thing.id,
        value: "hello",
        extra: "extra",
        extra2: 5,
      });
      expect(v0ToV1Migration).not.toHaveBeenCalled();
      expect(v1ToV2Migration).toHaveBeenCalled();
    });
  });
});
