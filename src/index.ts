import Joi from "joi";
import { v4 } from "uuid";

import type { Options, PlainObject } from "./types";
import Table from "./table";

export type { Options } from "./types";

let STORES: { [name: string]: Table } = {};

export const types = {
  id() {
    return Joi.string()
      .guid({ version: "uuidv4" })
      .default(() => v4());
  },
  stringSet() {
    return Joi.array().items(Joi.string()).default([]).meta({ type: "SS" });
  },
};

export function define<T extends PlainObject>(options: Options) {
  const t = new Table(options);
  const allowNameClash = options.allowNameClash ?? false;
  if (STORES[t.name] && !allowNameClash) {
    throw new Error(
      `Trying to define store with clashing table name: "${t.name}"`
    );
  }
  STORES[t.name] = t;

  const validator = options.schema;

  return {
    async create(obj: Omit<T, "id"> | T): Promise<T> {
      const validated: T = await validator.validateAsync(obj);
      const result = await t.create(validated);
      return result as T;
    },

    async put(obj: T): Promise<T> {
      return this.create(obj);
    },

    async getByHashKey(key: string): Promise<T | null> {
      const res = await t.getByHashKey(key);
      if (res === null) {
        return res;
      }
      return res as T;
    },

    async getByHashAndRangeKey(
      hashKey: string,
      rangeKey: string
    ): Promise<T | null> {
      if (!options.rangeKey) {
        throw new Error(`No defined range key on store: '${t.name}'`);
      }

      const res = await t.getByHashAndRangeKey(hashKey, rangeKey);
      if (res === null) {
        return res;
      }
      return res as T;
    },

    async getAllByHashKey(hashKey: string): Promise<T[]> {
      const validated = await t.getAllByHashKey(hashKey);
      return validated as T[];
    },

    async getByIndex(
      name: string,
      hashKey: string,
      sortKey?: string
    ): Promise<T | null> {
      const res = await t.getByIndex(name, hashKey, sortKey);
      if (res === null) {
        return res;
      }
      return res as T;
    },

    async scan(): Promise<T[]> {
      const res = await t.scan();
      return res as T[];
    },

    async deleteByHashKey(hashKey: string): Promise<void> {
      await t.deleteByHashKey(hashKey);
    },
  };
}

export async function createTables() {
  return Promise.all(
    Object.values(STORES).map(async (t) => {
      const itExists = await t.tableExists();
      if (!itExists) {
        await t.createTable();
      }
    })
  );
}

async function deleteManagedTables() {
  await Promise.all(
    Object.values(STORES).map(async (t) => {
      const itExists = await t.tableExists();
      if (itExists) {
        await t.deleteTable();
      }
    })
  );
}

export async function deleteTables() {
  await deleteManagedTables();
  STORES = {};
}

export async function clearTables() {
  await deleteManagedTables();
  await createTables();
}

export default {
  createTables,
  deleteTables,
  clearTables,
  define,
  types,
};
