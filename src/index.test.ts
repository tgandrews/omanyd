import { AnyRecord } from "dns";
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.number().required(),
          value2: Joi.number().required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.boolean().required(),
          value2: Joi.boolean().required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.object({
            key1: Joi.string().required(),
            key2: Joi.number().required(),
            key3: Omanyd.types.stringSet().required(),
          }).required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.any(),
          value2: Joi.number().required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.string(),
        },
      });

      await Omanyd.createTables();

      const savedThing = await ThingStore.create({ value: undefined });

      expect(savedThing).toStrictEqual({
        id: savedThing.id,
      });
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
        schema: {
          id: Joi.string().required(),
          version: Joi.string().required(),
          value: Joi.string().required(),
        },
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

    it("should allow for an item to be read when using range key", async () => {
      interface Thing {
        id: string;
        version: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>({
        name: "rangeKeyItemNotFound",
        hashKey: "id",
        rangeKey: "version",
        schema: {
          id: Joi.string().required(),
          version: Joi.string().required(),
          value: Joi.string().required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          version: Joi.string().required(),
          value: Joi.string().required(),
        },
      });

      await Omanyd.createTables();

      await expect(
        async () => await ThingStore.getByHashAndRangeKey("id", "2")
      ).rejects.toThrow(/no defined range key/i);
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.any().required(),
        },
      });

      await Omanyd.createTables();

      await expect(async () =>
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.any().required(),
        },
      });

      await Omanyd.createTables();

      await expect(async () =>
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.any().required(),
        },
      });

      await Omanyd.createTables();

      await expect(async () =>
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        },
      });

      await Omanyd.createTables();

      await expect(async () =>
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
        schema: {
          id: Omanyd.types.id(),
          value: Omanyd.types.stringSet(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          value: Omanyd.types.stringSet(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.array().items(Joi.any()).required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.array().items(Joi.any()).required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          email: Joi.string().required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          email: Joi.string().required(),
        },
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
        schema: {
          id: Omanyd.types.id(),
          email: Joi.string().required(),
        },
      });

      await Omanyd.createTables();

      await expect(async () =>
        ThingStore.getByIndex("ValueIndex", "hello@world.com")
      ).rejects.toThrow(/No index found with name: 'ValueIndex'/);
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        },
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
    it("shoudl error when defining two stores for the same table", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      Omanyd.define<Thing>({
        name: "multipleTablesError",
        hashKey: "id",
        schema: {
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        },
      });
      expect(() => {
        Omanyd.define<Thing>({
          name: "multipleTablesError",
          hashKey: "id",
          schema: {
            id: Omanyd.types.id(),
            value: Joi.string().required(),
          },
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
        schema: {
          id: Omanyd.types.id(),
          value: Joi.string().required(),
        },
      });
      expect(() => {
        Omanyd.define<Thing>({
          name: "multipleTablesSuccess",
          hashKey: "id",
          schema: {
            id: Omanyd.types.id(),
            value: Joi.string().required(),
            extras: Joi.array().items(Joi.string()),
          },
          allowNameClash: true,
        });
      }).not.toThrow();
    });
  });
});
