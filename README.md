# graphql-fakester

Create stub data by querying a GraphQL schema.

This might be useful together with something like the [Apollo](https://www.apollographql.com/) [MockProvider](https://www.apollographql.com/docs/react/development-testing/testing/).

## Installation

```sh
npm install graphql-fakester
```

## Usage

```js
import { GraphQLMock } from "graphql-fakester";

const typeDefs = `
  type Author {
    id: ID!
    firstName: String
    lastName: String
    email: String
    posts: [Post]
  }

  type Post {
    id: ID!
    title: String
    author: Author
    votes: Int
  }

  type Query {
    posts: [Post]
    author(id: ID!): Author
  }

  type Mutation {
    upvotePost(postId: ID!): Post
  }
`;

let mock = new GraphQLMock({ typeDefs });

const authorQuery = `
  query authorFirstName($id: ID!) {
    author(id: $id) {
      firstName
      lastName
      email
      posts {
        id
        title
      }
    }
  }
`;

let result = await moch.execute(authorQuery, { id: "42" });

expect(result, "to satisfy", {
  data: {
    author: {
      firstName: 'herubju',
      lastName: 'nocpebe'
      email: 'kelecse',
      posts: [
        { id: "1828976169320448", title: "jeminode" },
        { id: "4158848130613248", title: "orimipon" },
      ],
    },
  },
});
```

## Overriding the default resolvers

This project uses [@graphql-tools/mock](https://www.graphql-tools.com/docs/mocking) as its basis and can be used in a very similar way.

If you just want to hardcode the overrides, you can do that the following way:

```js
mock = new GraphQLMock({
  typeDefs,
  overrides: {
    Author: { firstName: "Jane", lastName: "Doe" },
  },
});

result = await moch.execute(authorQuery, { id: "42" });

expect(result, "to satisfy", {
  data: {
    author: {
      firstName: "Jane",
      lastName: "Doe",
      email: "kelecse",
      posts: [
        { id: "1828976169320448", title: "jeminode" },
        { id: "4158848130613248", title: "orimipon" },
      ],
    },
  },
});
```

In case you need to seeded generate random data from a override, you can provide a function.

The each of the top-level override function will be given a [chancejs](https://www.chancejs.com) instance that can be used to generate random seeded data, a root object containing the resolved parent data, an args object containing the arguments for the query, a context and an info object containing information about the query.

See the [mocking documentation](https://www.graphql-tools.com/docs/mocking) for more details.

## Controlling a collection resolver

```js
import { list } from "graphql-fakester"

mock = new GraphQLMock({
  typeDefs,
  overrides: {
    Author: {
      firstName: "Jane",
      lastName: "Doe",
      posts: list({ length: 3 }),
    },
  },
});

result = await moch.execute(authorQuery, { id: "42" });

expect(result, "to satisfy", {
  data: {
    author: {
      firstName: 'herubju',
      lastName: 'nocpebe'
      email: "kelecse",
      posts: [
        { id: "1828976169320448", title: "jeminode" },
        { id: "4158848130613248", title: "orimipon" },
        { id: "4158848130613248", title: "orimipon" },
      ],
    },
  },
});
```

It is also possible to use `min` and `max` instead of the `length`.

```js
mock = new GraphQLMock({
  typeDefs,
  overrides: {
    Author: {
      posts: list({ min: 1, max: 5 }),
    },
  },
});

result = await moch.execute(authorQuery, { id: "42" });

expect(result, "to satisfy", {
  data: {
    author: {
      firstName: 'herubju',
      lastName: 'nocpebe'
      email: "kelecse",
      posts: [
        { id: "1828976169320448", title: "jeminode" },
        { id: "4158848130613248", title: "orimipon" },
      ],
    },
  },
});
```

Notice `min` defaults to 0 and `max` defaults to 10, so can just call the list function without any arguments, or only send in either `min` or `max`.

## Creating a preconfigured mock

```js
class MyMock extends GraphQLMock {
  constructor(overrides) {
    super({
      typeDefs,
      overrides: [
        {
          Author: (chance) => ({
            email: chance.email(),
            posts: list({ length: 3 }),
          }),
          Post: (chance) => ({
            title: `title-${chance.word()}`,
          }),
        },
        overrides,
      ],
    });
  }
}

mock = new MyMock({
  Author: (chance) => ({
    firstName: "Jane",
    lastName: "Doe",
  }),
});

result = await mock.execute(authorQuery, { id: authorId });

expect(result, "to satisfy", {
  data: {
    author: {
      firstName: "Jane",
      lastName: "Doe",
      email: "ketis@ziluwi.cw",
      posts: [
        { id: "6325555974635520", title: "title-ha" },
        { id: "308014672248832", title: "title-felsuh" },
      ],
    },
  },
});
```
