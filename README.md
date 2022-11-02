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

  type Comment {
    id: ID!
    text: String!
  }

  type CommentConnectionEdge {
    cursor: String!
    node: Comment
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type CommentConnection {
    edges: [CommentConnectionEdge!]!
    total: Int!
    pageInfo: PageInfo!
  }

  type Post {
    id: ID!
    title: String
    text: String
    author: Author
    votes: Int
    comments(
      first: Int
      last: Int
      after: String
      before: String
    ): CommentConnection!
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

let result = await mock.execute(authorQuery, { id: "42" });

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

You can also provide the query and the variables as an option object:

```js
result = await mock.execute({ query: authorQuery, variables: { id: "42" } });

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
    Author: {
      firstName: "Jane",
      lastName: "Doe",
      posts: [{ title: "First post" }, {}],
    },
  },
});

result = await mock.execute(authorQuery, { id: "42" });

expect(result, "to satisfy", {
  data: {
    author: {
      id: "4945079106011136",
      firstName: "Jane",
      lastName: "Doe",
      email: "kelecse",
      posts: [
        { id: "1828976169320448", title: "First post" },
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
      posts: list(3),
    },
  },
});

result = await mock.execute(authorQuery, { id: "42" });

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

You can use [chance](https://chancejs.com/) to create a variable length list this way.

```js
mock = new GraphQLMock({
  typeDefs,
  mocks: {
    Author: chance => ({
      posts: list(chance.integer{ min: 1, max: 5 }),
    }),
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

## Mock a Relay connection resolver

```js
import { connection } from "graphql-fakester";

mock = new GraphQLMock({
  typeDefs,
  mocks: {
    posts: list(1),
    CommentConnection: connection(1, { includeTotal: true }),
  },
});

const postsQuery = `
  query postsQuery {
    posts {
      id
      title
      comments(first: 1) {
        edges {
          cursor
          node {
            id
            text
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          hasNextPage
          endCursor
        }
        total
      }
    }
  }
`;

result = await mock.execute(postsQuery);

expect(result, "to satisfy", {
  data: {
    posts: [
      {
        id: "4945079106011136",
        title: "herubju",
        comments: {
          edges: [
            {
              cursor: "cursor-0",
              node: { id: "6325555974635520", text: "nocpebe" },
            },
          ],
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: false,
            endCursor: "cursor-0",
          },
          total: 1,
        },
      },
    ],
  },
});
```

Options:

- includeTotal (false): If a total field should be included
- hasNextPage (true): sets the pageInfo.hasNextPage value
- hasPreviousPage (false): sets the pageInfo.hasPreviousPage value

## Overriding a special list entry

You can get a sequence number corresponding to the number of time a mock has been resolved. This can be used to respond specially for a certain index in a list:

```js
mock = new GraphQLMock({
  typeDefs,
  mocks: {
    Author: { posts: list(5) },
    Post: (chance, seq) =>
      seq === 3 ? { title: "My very special title" } : {},
  },
});

result = await mock.execute(authorQuery, { id: authorId });

expect(result, "to satisfy", {
  data: {
    author: {
      id: "4945079106011136",
      firstName: "herubju",
      lastName: "nocpebe",
      email: "kelecse",
      posts: [
        { id: "6325555974635520", title: "jeminode" },
        { id: "308014672248832", title: "orimipon" },
        { id: "1702188611010560", title: "rurzilru" },
        { id: "1828976169320448", title: "My very special title" },
        { id: "4158848130613248", title: "lufzipav" },
      ],
    },
  },
});
```

## Cycling through mocks

Sometimes it is useful to provide a cycle through a finite list of mocks. You can use the `cycle` utility for this purpose.

```js
import { cycle } from "graphql-fakester";

mock = new GraphQLMock({
  typeDefs,
  mocks: {
    Author: { posts: list(5) },
    Post: cycle(
      { title: "foo" },
      (chance) => ({ title: `bar-${chance.word()}` }),
      { title: "baz" }
    ),
  },
});

result = await mock.execute(authorQuery, { id: authorId });

expect(result, "to satisfy", {
  data: {
    author: {
      id: "4945079106011136",
      firstName: "herubju",
      lastName: "nocpebe",
      email: "kelecse",
      posts: [
        { id: "6325555974635520", title: "foo" },
        { id: "308014672248832", title: "bar-ketis" },
        { id: "1702188611010560", title: "baz" },
        { id: "1828976169320448", title: "foo" },
        { id: "4158848130613248", title: "bar-ziluwi" },
      ],
    },
  },
});
```

## Using a specific list of mocks

In other cases you might want to specify the first `n` mocks and just repeat the last one, you can do that with the `values` utility.

Notice that the last mock will be repeated when all the initial mocks has been used, so it is a good idea to put some randomness into the final mock.

```js
import { values } from "graphql-fakester";

mock = new GraphQLMock({
  typeDefs,
  mocks: {
    Author: { posts: list(5) },
    Post: values({ title: "foo" }, { title: "bar" }, (chance) => ({
      title: `baz-${chance.word()}`,
    })),
  },
});

result = await mock.execute(authorQuery, { id: authorId });

expect(result, "to satisfy", {
  data: {
    author: {
      id: "4945079106011136",
      firstName: "herubju",
      lastName: "nocpebe",
      email: "kelecse",
      posts: [
        { id: "6325555974635520", title: "foo" },
        { id: "308014672248832", title: "bar" },
        { id: "1702188611010560", title: "baz-ketis" },
        { id: "1828976169320448", title: "baz-ziluwi" },
        { id: "4158848130613248", title: "baz-zev" },
      ],
    },
  },
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
            posts: list(3),
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
