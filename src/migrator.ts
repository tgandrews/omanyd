import type Joi from "joi";
import { PlainObject, Version, VersionedObject } from "./types";

export default class Migrator {
  constructor(
    private versions: Version[],
    private currentSchema: Joi.ObjectSchema
  ) {}

  async migrate(obj: VersionedObject): Promise<PlainObject> {
    const objectVersion = obj._v;
    const clientObject: PlainObject = obj as PlainObject;
    delete clientObject._v;
    const versionsToMigrate = this.versions.slice(objectVersion);

    // Check if read version from the DB is valid to its schema
    const validatedResult = await (
      versionsToMigrate[0]?.schema ?? this.currentSchema
    ).validateAsync(clientObject);

    let upToDateObject = validatedResult;
    for (let i = 0; i < versionsToMigrate.length; ++i) {
      const { migrate } = versionsToMigrate[i];
      const migratedResult = migrate(upToDateObject);
      const targetSchema =
        versionsToMigrate[i + 1]?.schema ?? this.currentSchema;
      const validatedMigratedResult = await targetSchema.validateAsync(
        migratedResult
      );
      upToDateObject = validatedMigratedResult;
    }
    return upToDateObject;
  }
}
