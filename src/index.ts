import Joi from "joi";
import { v4 } from "uuid";

import Table from "./table";

let TABLES: Table[] = [];

interface Options {
  hashKey: string;
  schema: {
    [key: string]: Joi.AnySchema;
  };
}

export const types = {
  id() {
    return Joi.string()
      .guid({ version: "uuidv4" })
      .default(() => v4());
  },
  stringSet() {
    return Joi.array().items(Joi.string()).default([]);
  },
};

export function define<T>(name: string, { hashKey, schema }: Options) {
  const t = new Table({ name, hashKeyName: hashKey });
  const validator = Joi.object(schema);
  TABLES.push(t);

  return {
    async create(obj: Omit<T, "id">): Promise<T> {
      const validated: T = await validator.validateAsync(obj);
      await t.create(validated);
      return validated;
    },

    async getByHashKey(key: string): Promise<T | null> {
      const res = await t.getByHashKey(key);
      if (res === null) {
        return res;
      }
      const validated = await validator.validateAsync(res);
      return (validated as unknown) as T;
    },

    async scan(): Promise<T[]> {
      const res = await t.scan();
      const validated = await Promise.all(
        res.map(async (r) => {
          return await validator.validateAsync(r);
        })
      );
      return (validated as unknown) as T[];
    },
  };
}

export async function createTables() {
  return Promise.all(
    TABLES.map(async (t) => {
      if (!(await t.tableExists())) {
        await t.createTable();
      }
    })
  );
}

export async function deleteTables() {
  await Promise.all(
    TABLES.map(async (t) => {
      if (await t.tableExists()) {
        await t.deleteTable();
      }
    })
  );
  TABLES = [];
}

export default {
  createTables,
  deleteTables,
  define,
  types,
};
