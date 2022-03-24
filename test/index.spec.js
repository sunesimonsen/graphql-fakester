const expect = require("unexpected")
  .clone()
  .use(require("unexpected-snapshot"));

const { GraphQLMock, list, cycle, values } = require("../src/index.js");

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
      it("the mocked field will be used", async () => {
        mock = new GraphQLMock({
          typeDefs,
          mocks: {
            Author: (chance) => ({
              firstName: chance.name(),
            }),
          },
        });

        const result = await mock.execute(authorNameQuery, { id: authorId });

        expect(
          result,
          "to inspect as snapshot",
          "{ data: { author: { firstName: 'Max Spencer', lastName: 'herubju' } } }"
        );
      });

      it("supply a second argument that is a sequence number", async () => {
        mock = new GraphQLMock({
          typeDefs,
          mocks: {
            Author: { posts: list(5) },
            Post: (chance, seq) =>
              seq === 3 ? { title: "My very special title" } : {},
          },
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
                  firstName: 'herubju',
                  lastName: 'nocpebe',
                  email: 'kelecse',
                  posts: [
                    { id: '6325555974635520', title: 'jeminode' },
                    { id: '308014672248832', title: 'orimipon' },
                    { id: '1702188611010560', title: 'rurzilru' },
                    { id: '1828976169320448', title: 'My very special title' },
                    { id: '4158848130613248', title: 'lufzipav' }
                  ]
                }
              }
            }
          `
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
              posts: list(3),
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

    describe("when mocking a list resolver to be variable length", () => {
      beforeEach(async () => {
        mock = new GraphQLMock({
          typeDefs,
          mocks: {
            Author: (chance) => ({
              posts: list(chance.integer({ min: 1, max: 5 })),
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
                email: 'kelecse',
                posts: [
                  { id: '6325555974635520', title: 'jeminode' },
                  { id: '308014672248832', title: 'orimipon' },
                  { id: '1702188611010560', title: 'rurzilru' }
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
            posts: list(3),
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
      const author = mock.getType("Author");

      expect(author, "to equal snapshot", {
        __typename: "Author",
        id: 0,
        firstName: "herubju",
        lastName: "nocpebe",
        email: "ketis@ziluwi.cw",
        favoritePost: {
          __typename: "Post",
          id: "1702188611010560",
          title: "kelecse",
          author: {
            __typename: "Author",
            id: "1828976169320448",
            firstName: "jeminode",
            lastName: "orimipon",
            email: "dabinalut@wepmevagi.gb",
          },
          votes: 14,
        },
      });
    });

    describe("when given a key", () => {
      it("returns a stubbed version of the given type with the id set to the key", () => {
        const author = mock.getType("Author", 42);

        expect(author, "to equal snapshot", {
          __typename: "Author",
          id: 42,
          firstName: "herubju",
          lastName: "nocpebe",
          email: "ketis@ziluwi.cw",
          favoritePost: {
            __typename: "Post",
            id: "1702188611010560",
            title: "kelecse",
            author: {
              __typename: "Author",
              id: "1828976169320448",
              firstName: "jeminode",
              lastName: "orimipon",
              email: "dabinalut@wepmevagi.gb",
            },
            votes: 14,
          },
        });
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
            id: "1702188611010560",
            title: "kelecse",
            author: {
              __typename: "Author",
              id: "1828976169320448",
              firstName: "jeminode",
              lastName: "orimipon",
              email: "dabinalut@wepmevagi.gb",
              posts: [
                {
                  __typename: "Post",
                  id: "4158848130613248",
                  title: "rurzilru",
                  author: {
                    __typename: "Author",
                    id: "5223687156400128",
                    firstName: "lufzipav",
                    lastName: "bujledol",
                    email: "jigibu@wurokfiz.ac",
                  },
                  votes: 13,
                },
                {
                  __typename: "Post",
                  id: "4620302535360512",
                  title: "jonubzov",
                  author: {
                    __typename: "Author",
                    id: "494041963692032",
                    firstName: "ocomohi",
                    lastName: "widdivew",
                    email: "lozki@mebjo.er",
                  },
                  votes: 30,
                },
                {
                  __typename: "Post",
                  id: "6201557219540992",
                  title: "zapugjeg",
                  author: {
                    __typename: "Author",
                    id: "4255354269466624",
                    firstName: "jatafose",
                    lastName: "gorogef",
                    email: "genowofe@talsahepi.cv",
                  },
                  votes: 47,
                },
              ],
              favoritePost: {
                __typename: "Post",
                id: "8364009338175488",
                title: "babucus",
                author: {
                  __typename: "Author",
                  id: "2715279572336640",
                  firstName: "dolira",
                  lastName: "kejipure",
                },
                votes: 50,
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
            id: "1834610061213696",
            title: "rurzilru",
            votes: 100,
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
                email: "saboela@hek.cg",
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
                email: "jigibu@wurokfiz.ac",
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
                email: "lozki@mebjo.er",
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
              email: "hoc@ripdetewe.gi",
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

describe("cycle", () => {
  let mock;

  beforeEach(async () => {
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
  });

  it("cycles the given mocks", async () => {
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
              email: 'kelecse',
              posts: [
                { id: '6325555974635520', title: 'foo' },
                { id: '308014672248832', title: 'bar-ketis' },
                { id: '1702188611010560', title: 'baz' },
                { id: '1828976169320448', title: 'foo' },
                { id: '4158848130613248', title: 'bar-ziluwi' }
              ]
            }
          }
        }
      `
    );
  });
});

describe("values", () => {
  let mock;

  beforeEach(async () => {
    mock = new GraphQLMock({
      typeDefs,
      mocks: {
        Author: { posts: list(5) },
        Post: values({ title: "foo" }, { title: "bar" }, (chance) => ({
          title: `baz-${chance.word()}`,
        })),
      },
    });
  });

  it("uses the given mocks in order", async () => {
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
              email: 'kelecse',
              posts: [
                { id: '6325555974635520', title: 'foo' },
                { id: '308014672248832', title: 'bar' },
                { id: '1702188611010560', title: 'baz-ketis' },
                { id: '1828976169320448', title: 'baz-ziluwi' },
                { id: '4158848130613248', title: 'baz-zev' }
              ]
            }
          }
        }
      `
    );
  });
});
