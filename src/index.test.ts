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
      const ThingStore = Omanyd.define<Thing>("basic", {
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
      const ThingStore = Omanyd.define<Thing>("basicNotFound", {
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
      const ThingStore = Omanyd.define<Thing>("basicNumber", {
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
      const ThingStore = Omanyd.define<Thing>("basicBoolean", {
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
      const ThingStore = Omanyd.define<Thing>("basicObject", {
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
      const ThingStore = Omanyd.define<Thing>("basicNull", {
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
  });

  describe("validation", () => {
    it("should reject objects containing functions", async () => {
      interface Thing {
        id: string;
        value: Function;
      }
      const ThingStore = Omanyd.define<Thing>("errorFunction", {
        hashKey: "id",
        schema: {
          id: Omanyd.types.id(),
          value: Joi.func().required(),
        },
      });

      await Omanyd.createTables();

      await expect(async () =>
        ThingStore.create({
          value: () => {
            return 1 + 1;
          },
        })
      ).rejects.toThrow(/Cannot serialize function to DynamoDB/);
    });

    it("should reject objects containing symbols", async () => {
      interface Thing {
        id: string;
        value: Symbol;
      }
      const ThingStore = Omanyd.define<Thing>("errorSymbol", {
        hashKey: "id",
        schema: {
          id: Omanyd.types.id(),
          value: Joi.symbol().required(),
        },
      });

      await Omanyd.createTables();

      await expect(async () =>
        ThingStore.create({
          value: Symbol("hi"),
        })
      ).rejects.toThrow(/Cannot serialize symbol to DynamoDB/);
    });

    it("should reject objects containing undefined", async () => {
      interface Thing {
        id: string;
        value?: string;
      }
      const ThingStore = Omanyd.define<Thing>("errorUndefined", {
        hashKey: "id",
        schema: {
          id: Omanyd.types.id(),
          value: Joi.string(),
        },
      });

      await Omanyd.createTables();

      await expect(async () =>
        ThingStore.create({
          value: undefined,
        })
      ).rejects.toThrow(/Cannot serialize undefined to DynamoDB/);
    });
  });

  describe("sets", () => {
    it("should allow for saving/reading of string sets", async () => {
      interface Thing {
        id: string;
        value: string[];
      }
      const ThingStore = Omanyd.define<Thing>("StringSet", {
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
      const ThingStore = Omanyd.define<Thing>("setEmpty", {
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

  describe("scan", () => {
    it("should be able to return all of the items in a table", async () => {
      interface Thing {
        id: string;
        value: string;
      }
      const ThingStore = Omanyd.define<Thing>("scanAll", {
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
      const ThingStore = Omanyd.define<Thing>("scanEmpty", {
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
});
