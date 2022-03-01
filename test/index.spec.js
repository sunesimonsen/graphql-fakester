const expect = require("unexpected")
  .clone()
  .use(require("unexpected-snapshot"));

const { GraphQLMock, list } = require("../src/index.js");

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

const authorNameQuery = `
  query authorFirstName($id: ID!) {
    author(id: $id) {
      firstName
      lastName
    }
  }
`;

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

const upvotePostMutation = `
  mutation upvotePost($postId: ID!) {
    upvotePost(postId: $postId) {
      title
      author {
        firstName
        lastName
      }
      votes
    }
  }
`;

const authorId = "6";
const postId = "7";

describe("graphql-fakester", () => {
  let mock;

  describe("when no mocks has been provided", () => {
    beforeEach(async () => {
      mock = new GraphQLMock({ typeDefs });
    });

    it("mocks basic types out of the box", async () => {
      const result = await mock.execute(authorNameQuery, { id: authorId });

      expect(
        result,
        "to inspect as snapshot",
        "{ data: { author: { firstName: 'herubju', lastName: 'nocpebe' } } }"
      );
    });
  });

  describe("when mocking a field on an object", () => {
    beforeEach(async () => {
      mock = new GraphQLMock({
        typeDefs,
        overrides: {
          Author: (chance, root, args, context, info) => ({
            firstName: chance.name(),
          }),
        },
      });
    });

    it("the mocked field will be used", async () => {
      const result = await mock.execute(authorNameQuery, { id: authorId });

      expect(
        result,
        "to inspect as snapshot",
        "{ data: { author: { firstName: 'Max Spencer', lastName: 'herubju' } } }"
      );
    });
  });

  describe("when hardcoding a field on an object", () => {
    beforeEach(async () => {
      mock = new GraphQLMock({
        typeDefs,
        overrides: {
          Author: { firstName: "Jane", lastName: "Doe" },
        },
      });
    });

    it("the mocked field will be used", async () => {
      const result = await mock.execute(authorNameQuery, { id: authorId });

      expect(
        result,
        "to inspect as snapshot",
        "{ data: { author: { firstName: 'Jane', lastName: 'Doe' } } }"
      );
    });
  });

  describe("when mocking a list resolver", () => {
    beforeEach(async () => {
      mock = new GraphQLMock({
        typeDefs,
        overrides: {
          Author: (chance) => ({
            email: chance.email(),
            posts: list({ length: 3 }),
          }),
          Post: (chance) => ({
            title: `title-${chance.word()}`,
          }),
        },
      });
    });

    it("returns the specified number of items", async () => {
      const result = await mock.execute(authorQuery, { id: authorId });

      expect(
        result,
        "to inspect as snapshot",
        expect.unindent`
          {
            data: {
              author: {
                firstName: 'herubju',
                lastName: 'nocpebe',
                email: 'ketis@ziluwi.cw',
                posts: [
                  { id: '6325555974635520', title: 'title-ha' },
                  { id: '308014672248832', title: 'title-felsuh' },
                  { id: '1702188611010560', title: 'title-rizede' }
                ]
              }
            }
          }
        `
      );
    });
  });

  describe("when executing a mutation", () => {
    beforeEach(async () => {
      mock = new GraphQLMock({
        typeDefs,
        overrides: {
          Mutation: {
            upvotePost: {
              votes: 42,
            },
          },
        },
      });
    });

    it("allows mocking the result", async () => {
      const result = await mock.execute(upvotePostMutation, { postId });

      expect(
        result,
        "to inspect as snapshot",
        expect.unindent`
          {
            data: {
              upvotePost: {
                title: 'herubju',
                author: { firstName: 'nocpebe', lastName: 'kelecse' },
                votes: 42
              }
            }
          }
        `
      );
    });
  });

  it("allows to create a custom configured mock using inheritance", async () => {
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

    const mock = new MyMock({
      Author: (chance) => ({
        firstName: "Jane",
        lastName: "Doe",
      }),
    });

    const result = await mock.execute(authorQuery, { id: authorId });

    expect(
      result,
      "to inspect as snapshot",
      expect.unindent`
          {
            data: {
              author: {
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'ketis@ziluwi.cw',
                posts: [
                  { id: '6325555974635520', title: 'title-ha' },
                  { id: '308014672248832', title: 'title-felsuh' },
                  { id: '1702188611010560', title: 'title-rizede' }
                ]
              }
            }
          }
        `
    );
  });
});
