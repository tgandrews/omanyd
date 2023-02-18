import type Joi from "joi";

/** Type workaround for https://github.com/Microsoft/TypeScript/issues/7294#issuecomment-465794460 */
type ArrayElem<A> = A extends Array<infer Elem> ? Elem : never;

export function elemT<T>(array: T): Array<ArrayElem<T>> {
  return array as any;
}

export type PlainObject = { [name: string]: any };

export type VersionedObject = PlainObject & { _v: number };

export type Version = {
  schema: Joi.ObjectSchema;
  // TODO: Improve typing here
  migrate: (T: any) => any;
};

export interface Options {
  name: string;
  hashKey: string;
  rangeKey?: string;
  schema: Joi.ObjectSchema;
  indexes?: {
    name: string;
    type: "global";
    hashKey: string;
    sortKey?: string;
  }[];
  allowNameClash?: boolean;
  versions?: Version[];
}
