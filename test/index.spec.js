const expect = require("unexpected")
  .clone()
  .use(require("unexpected-snapshot"));

const { GraphQLMock, list } = require("../src/index.js");

const typeDefs = `
  type Author {
    id: ID!
    firstName: String!
    lastName: String!
    email: String
    posts: [Post!]
    favoritePost: Post
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
      id
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

  describe("execute", () => {
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
          mocks: {
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
          mocks: {
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

    describe("when override the default resolvers", () => {
      beforeEach(async () => {
        mock = new GraphQLMock({
          typeDefs,
          mocks: {
            Author: (chance) => ({
              email: chance.email(),
            }),
          },
          resolvers: (store) => ({
            Query: {
              author: (root, { id }) => store.get("Author", id),
            },
          }),
        });
      });

      it("uses the resolvers", async () => {
        const result = await mock.execute(authorQuery, { id: authorId });

        expect(
          result,
          "to inspect as snapshot",
          expect.unindent`
          {
            data: {
              author: {
                id: '6',
                firstName: 'herubju',
                lastName: 'nocpebe',
                email: 'ketis@ziluwi.cw',
                posts: [
                  { id: '4945079106011136', title: 'kelecse' },
                  { id: '6325555974635520', title: 'jeminode' }
                ]
              }
            }
          }
        `
        );
      });
    });

    describe("when mocking a list resolver", () => {
      beforeEach(async () => {
        mock = new GraphQLMock({
          typeDefs,
          mocks: {
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
                id: '4945079106011136',
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
          mocks: {
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
              id: '4945079106011136',
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

  describe("getType", () => {
    beforeEach(async () => {
      mock = new GraphQLMock({
        typeDefs,
        mocks: {
          Author: (chance) => ({
            email: chance.email(),
            posts: list({ length: 3 }),
          }),
          Post: (chance) => ({
            votes: chance.natural({ max: 100 }),
          }),
        },
      });
    });

    it("throws when asked for an unknown type", () => {
      expect(
        () => {
          mock.getType("MyUndefinedType");
        },
        "to throw",
        "Unknown type: MyUndefinedType"
      );
    });

    it("returns a stubbed version of the given type", () => {
      const author = mock.getType("Author", 42);

      expect(author, "to equal snapshot", {
        __typename: "Author",
        id: 42,
        firstName: "herubju",
        lastName: "nocpebe",
        email: "ketis@ziluwi.cw",
        favoritePost: {
          __typename: "Post",
          id: "4945079106011136",
          title: "kelecse",
          author: {
            __typename: "Author",
            id: "6325555974635520",
            firstName: "jeminode",
            lastName: "orimipon",
            email: "dabinalut@wepmevagi.gb",
          },
          votes: 13,
        },
      });
    });

    describe("when asking for the same entity twice", () => {
      describe("and the depth and likelihook is the same", () => {
        it("returns the same object", () => {
          expect(
            mock.getType("Author", 42),
            "to be",
            mock.getType("Author", 42)
          );
        });
      });

      describe("and the depth is different", () => {
        it("returns a new object", () => {
          expect(
            mock.getType("Author", 42),
            "not to be",
            mock.getType("Author", 42, { depth: 3 })
          );
        });
      });

      describe("and the likelihook is different", () => {
        it("returns a new object", () => {
          expect(
            mock.getType("Author", 42),
            "not to be",
            mock.getType("Author", 42, { likelihood: 30 })
          );
        });
      });
    });

    it("uses the given id", () => {
      const author = mock.getType("Author", 42);

      expect(author, "to satisfy", { id: 42 });
    });

    describe("when given a depth", () => {
      it("stubs to the depth", () => {
        const author = mock.getType("Author", 42, { depth: 4 });

        expect(author, "to equal snapshot", {
          __typename: "Author",
          id: 42,
          firstName: "herubju",
          lastName: "nocpebe",
          email: "ketis@ziluwi.cw",
          favoritePost: {
            __typename: "Post",
            id: "4945079106011136",
            title: "kelecse",
            author: {
              __typename: "Author",
              id: "6325555974635520",
              firstName: "jeminode",
              lastName: "orimipon",
              email: "dabinalut@wepmevagi.gb",
              posts: [
                {
                  __typename: "Post",
                  id: "308014672248832",
                  title: "rurzilru",
                  author: {
                    __typename: "Author",
                    id: "4158848130613248",
                    firstName: "lufzipav",
                    lastName: "bujledol",
                    email: "bihac@su.cr",
                  },
                  votes: 14,
                },
                {
                  __typename: "Post",
                  id: "1702188611010560",
                  title: "jonubzov",
                  author: {
                    __typename: "Author",
                    id: "8977495304962048",
                    firstName: "ocomohi",
                    lastName: "widdivew",
                    email: "zem@fad.be",
                  },
                  votes: 61,
                },
                {
                  __typename: "Post",
                  id: "1828976169320448",
                  title: "zapugjeg",
                  author: {
                    __typename: "Author",
                    id: "3264289079033856",
                    firstName: "jatafose",
                    lastName: "gorogef",
                    email: "tohuh@vi.bh",
                  },
                  votes: 60,
                },
              ],
              favoritePost: {
                __typename: "Post",
                id: "8817102102200320",
                title: "babucus",
                author: {
                  __typename: "Author",
                  id: "4255354269466624",
                  firstName: "dolira",
                  lastName: "kejipure",
                },
                votes: 26,
              },
            },
          },
        });
      });
    });

    describe("when given a likelihood of zero", () => {
      it("only includes required fields", () => {
        const author = mock.getType("Author", 42, { likelihood: 0 });

        expect(author, "to equal snapshot", {
          __typename: "Author",
          id: 42,
          firstName: "herubju",
          lastName: "nocpebe",
        });
      });
    });

    describe("when given a likelihood of 100", () => {
      it("includes all fields while respecting the depth", () => {
        const author = mock.getType("Author", 42, {
          depth: 1,
          likelihood: 100,
        });

        expect(author, "to equal snapshot", {
          __typename: "Author",
          id: 42,
          firstName: "herubju",
          lastName: "nocpebe",
          email: "ketis@ziluwi.cw",
          posts: [
            {
              __typename: "Post",
              id: "4945079106011136",
              title: "kelecse",
              votes: 13,
            },
            {
              __typename: "Post",
              id: "6325555974635520",
              title: "jeminode",
              votes: 27,
            },
            {
              __typename: "Post",
              id: "308014672248832",
              title: "orimipon",
              votes: 25,
            },
          ],
          favoritePost: {
            __typename: "Post",
            id: "4620302535360512",
            title: "rurzilru",
            votes: 73,
          },
        });
      });
    });

    describe("when given a likelihood", () => {
      it("includes optional fields based on that likelihood", () => {
        const author = mock.getType("Author", 42, { likelihood: 100 });

        expect(author, "to equal snapshot", {
          __typename: "Author",
          id: 42,
          firstName: "herubju",
          lastName: "nocpebe",
          email: "ketis@ziluwi.cw",
          posts: [
            {
              __typename: "Post",
              id: "4945079106011136",
              title: "kelecse",
              author: {
                __typename: "Author",
                id: "1702188611010560",
                firstName: "jeminode",
                lastName: "orimipon",
                email: "dabinalut@wepmevagi.gb",
              },
              votes: 13,
            },
            {
              __typename: "Post",
              id: "6325555974635520",
              title: "rurzilru",
              author: {
                __typename: "Author",
                id: "5223687156400128",
                firstName: "lufzipav",
                lastName: "bujledol",
                email: "dowwipwo@dib.ma",
              },
              votes: 27,
            },
            {
              __typename: "Post",
              id: "308014672248832",
              title: "jonubzov",
              author: {
                __typename: "Author",
                id: "494041963692032",
                firstName: "ocomohi",
                lastName: "widdivew",
                email: "be@tesih.bn",
              },
              votes: 25,
            },
          ],
          favoritePost: {
            __typename: "Post",
            id: "4255354269466624",
            title: "zapugjeg",
            author: {
              __typename: "Author",
              id: "2941350620168192",
              firstName: "jatafose",
              lastName: "gorogef",
              email: "asmedum@vudsufsa.ga",
            },
            votes: 26,
          },
        });
      });
    });

    describe("when given both a depth and a likelihood", () => {
      it("includes optional fields based on that likelihood to the given depth", () => {
        const author = mock.getType("Author", 42, { depth: 1, likelihood: 30 });

        expect(author, "to equal snapshot", {
          __typename: "Author",
          id: 42,
          firstName: "herubju",
          lastName: "nocpebe",
        });
      });
    });
  });
});
