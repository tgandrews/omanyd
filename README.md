# Omanyd

A simple but production ready dynamodb mapper.

[![Coverage Status](https://coveralls.io/repos/github/tgandrews/omanyd/badge.svg?branch=main)](https://coveralls.io/github/tgandrews/omanyd?branch=main)

## Features

- Simplified data modeling and mapping to DynamoDB types
- Data validation using [Joi](https://joi.dev/)
- [Autogenerating IDs](#Creating)
- Complete typescript typings
- Basic global indexes

### Missing features

- Parallel scans
- Paging
- Complex querying
- Number and binary sets
- Boolean types
- Date types
- Lists
- Local indexes

## Installation

npm: `npm install omanyd joi`  
yarn: `yarn add omanyd joi`

Both packages come with the necessary types so no need to download
anything additional for typescript.

## Getting Started

Set the AWS environment variables before running the program

```bash
AWS_REGION="REGION" \
AWS_ACCESS_KEY_ID="ACCESS KEY ID" \
AWS_SECRET_ACCESS_KEY="SECRET ACCESS KEY" \
node app.js
```

These will already by defined for you if you are running in ec2 or lambda.

For running locally we recommend using the [official dynamodb docker container](https://hub.docker.com/r/amazon/dynamodb-local)
and then providing an additional environment variable to override the dynamodb url.

```bash
DYNAMODB_URL=http://localhost:8000
```

### Define a Store

Stores are defined through `define`. You provide the table name, schema and hashKey definition.
Stores are the accessors to underlying dymamodb table.

```ts
import Omanyd from "omanyd";
import Joi from "joi";

interface Tweet {
  id: string;
  content: string;
}
const TweetStore = Omanyd.define<Tweet>({
  name: "Tweet",
  hashKey: "id",
  schema: {
    id: Omanyd.types.id(),
    content: Joi.string(),
  },
});
```

### Create tables (for testing)

You can create tables for use locally during tests but should be managing this with a proper tool
[IaC](https://en.wikipedia.org/wiki/Infrastructure_as_code) for production.

This expects all stores defined using the define method above before use. It will skip creating a
table if it already exists so this cannot be used for modifying a table definition.

```js
import { createTables } from "omanyd";

await createTables();
```

### Delete Tables (for testing)

You can delete tables for use locally during tests but should be managing this with a proper tool
[IaC](https://en.wikipedia.org/wiki/Infrastructure_as_code) for production.

This expects all stores defined using the define method above before use. It then clears all saved
definitions so they can be redefined.

```ts
import { deleteTables } from "omanyd";

await deleteTables();
```

### Creating

Once you have defined your store you can create models from it and unless you provide an id then one
will be created for you automatically as the `omanyd.types.id()` was used in the [definition above](#Define%20a%20model)

```ts
const tweet = TweetStore.create({ content: "My first tweet" });
console.log(tweet);
/*
 * { id: "958f2b51-774a-436a-951e-9834de3fe559", content: "My first tweet"  }
 */
```

### Reading one - getting by hash key

Now that we have some data in the store we can now read it. The quickest way is reading directly by the hash key.

```ts
const readTweet = TweetStore.getByHashKey(
  "958f2b51-774a-436a-951e-9834de3fe559"
);
console.log(readTweet);
/*
 * { id: "958f2b51-774a-436a-951e-9834de3fe559", content: "My first tweet"  }
 */
```

### Reading many - scanning

If we want all of the items in the store we can use a scan. DynamoDB scans come with some [interesting caveats](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html).

```ts
await Promise.all([
  TweetStore.create({ content: "My second tweet" }),
  TweetStore.create({ content: "My third tweet" }),
  TweetStore.create({ content: "My fourth tweet" }),
]);

const tweets = await TweetStore.scan();

console.log(tweets);
/* [
 *   { id: "958f2b51-774a-436a-951e-9834de3fe559", content: "My first tweet"  },
 *   { id: "aa6ea347-e3d3-4c73-8960-709fa47e3a4c", content: "My second tweet"  },
 *   { id: "9cd6b18a-eafd-49c2-8f0f-d3bf8e75c26e", content: "My third tweet"  },
 *   { id: "fc446fcd-d65a-4ae2-ba9f-6bd94aae8705", content: "My fourth tweet"  }
 * ]
 */
```

### Global indexes

It is possible to quickly access documents by keys other than their hash key. This is done through
indexes.

Indexes should be created as a part of your table creation but need to be defined with Omanyd so
they can be used at run time correctly.

```ts
import Omanyd from "omanyd";
import Joi from "joi";

interface User {
  id: string;
  content: string;
}
const UserStore = Omanyd.define<User>({
  name: "Users",
  hashKey: "id",
  schema: {
    id: Omanyd.types.id(),
    email: Joi.string().required(),
  },
  indexes: [
    {
      name: "EmailIndex",
      type: "global",
      hashKey: "email",
    },
  ],
});

// Assuming table and index have been created separately

await UserStore.create({ email: "hello@world.com" });

const user = await UserStore.getByIndex("EmailIndex", "hello@world.com");
console.log(user);
/*
 * { id: "958f2b51-774a-436a-951e-9834de3fe559", email: "hello@world.com"  }
 */
```

## History

Omanyd was originally inspired by [dynamodb](https://www.npmjs.com/package/dynamodb) and [dynamoose](https://www.npmjs.com/package/dynamoose)

## Support

Omanyd is provided as-is, free of charge. For support, you have a few choices:

- Ask your support question on [Stackoverflow.com](http://stackoverflow.com), and tag your question with **omanyd**.
- If you believe you have found a bug in omanyd, please submit a support ticket on the [Github Issues page for omanyd](http://github.com/tgandrews/omanyd/issues).
