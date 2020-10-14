import type Joi from "joi";

/** Type workaround for https://github.com/Microsoft/TypeScript/issues/7294#issuecomment-465794460 */
type ArrayElem<A> = A extends Array<infer Elem> ? Elem : never;

export function elemT<T>(array: T): Array<ArrayElem<T>> {
  return array as any;
}

export type PlainObject = { [name: string]: any };
export type PlainObjectOf<T> = { [name: string]: T };

export function isPlainObject(obj: any): obj is PlainObject {
  return (obj && obj.constructor === Object) || false;
}

export interface Options {
  name: string;
  hashKey: string;
  schema: {
    [key: string]: Joi.AnySchema;
  };
  indexes?: {
    name: string;
    type: "global";
    hashKey: string;
  }[];
}
