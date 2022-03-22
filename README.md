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
      id: "4945079106011136",
      firstName: "herubju",
      lastName: "nocpebe",
      email: "kelecse",
      posts: [
        { id: "1828976169320448", title: "jeminode" },
        { id: "4158848130613248", title: "orimipon" },
      ],
    },
  },
});
```

## Overriding the default mocks

This project uses [@graphql-tools/mock](https://www.graphql-tools.com/docs/mocking) as its basis and can be used in a very similar way.

If you just want to hardcode an override, you can do that the following way:

```js
mock = new GraphQLMock({
  typeDefs,
  mocks: {
    Author: { firstName: "Jane", lastName: "Doe" },
  },
});

result = await moch.execute(authorQuery, { id: "42" });

expect(result, "to satisfy", {
  data: {
    author: {
      id: "4945079106011136",
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

## Mocking a list resolver

```js
import { list } from "graphql-fakester";

mock = new GraphQLMock({
  typeDefs,
  mocks: {
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
      id: "4945079106011136",
      firstName: "herubju",
      lastName: "nocpebe",
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
  mocks: {
    Author: {
      posts: list({ min: 1, max: 5 }),
    },
  },
});

result = await mock.execute(authorQuery, { id: "42" });

expect(result, "to satisfy", {
  data: {
    author: {
      id: j4945079106011136j,
      firstName: "herubju",
      lastName: "nocpebe",
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

## Generating stub types

You can ask for a type by name the following way:

```js
let author = mock.getType("Author", 42);
expect(author, "to satisfy", {
  id: 42,
  firstName: "herubju",
  lastName: "nocpebe",
  email: "ketis@ziluwi.cw",
  favoritePost: {
    id: "4945079106011136",
    title: "kelecse",
    author: {
      id: "6325555974635520",
      firstName: "jeminode",
      lastName: "orimipon",
      email: "dabinalut@wepmevagi.gb",
    },
    votes: 13,
  },
});
```

You can control the likelihood of optional fields being included using the `likelihood` options that takes a percentage. Default likelihood is `80`.

You can also control the recursion depth using the `depth` option. Default depth is 2.

```js
author = mock.getType("Author", 42, { depth: 1, likelihood: 30 });
expect(author, "to equal snapshot", {
  __typename: "Author",
  id: 42,
  firstName: "herubju",
  lastName: "nocpebe",
});
```

## Providing custom resolvers

It is possible to create a custom resolver that can use the mock store to retrieve or update the stored mocks.

This can be useful for mocking resolvers where the arguments are important.

Here we want to make sure that when we resolve an author, we get the id we asked for:

```js
mock = new GraphQLMock({
  typeDefs,
  resolvers: (store) => ({
    Query: {
      author: (root, { id }) => store.get("Author", id),
    },
  }),
});

result = await mock.execute(authorQuery, { id: "42" });

expect(result, "to satisfy", {
  data: {
    author: {
      id: "42",
      firstName: "herubju",
      lastName: "nocpebe",
      email: "kelecse",
      posts: [
        { id: "1828976169320448", title: "jeminode" },
        { id: "4158848130613248", title: "orimipon" },
      ],
    },
  },
});
```

See [Handling \*byId fields](https://www.graphql-tools.com/docs/mocking#handling-byid-fields) for more information.

## Creating a preconfigured mock

```js
class MyMock extends GraphQLMock {
  constructor(mocks) {
    super({
      typeDefs,
      mocks: [
        {
          Author: (chance) => ({
            email: chance.email(),
            posts: list({ length: 3 }),
          }),
          Post: (chance) => ({
            title: `title-${chance.word()}`,
          }),
        },
        mocks,
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
