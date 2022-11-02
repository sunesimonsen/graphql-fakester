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
    rating: Float
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

const postTitlesQuery = `
  query postTitles {
    posts {
      id
      title
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

const brokenAuthorQuery = `
  query authorFirstName($id: ID!) {
    author(id: $id) {
      id
      firstName
      lastName
      emails
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
          "{ data: { author: { firstName: 'herubju', lastName: 'nocpebe', __typename: 'Author' } } }"
        );
      });
    });

    it("throw an error when providing an unknown resolver", () => {
      expect(
        () => {
          // eslint-disable-next-line no-new
          new GraphQLMock({
            typeDefs,
            mocks: { Athor: { title: "This doesn't exists" } },
          });
        },
        "to throw",
        "Trying to override unknown type: Athor - did you mean Author"
      );
    });

    it("throw an error when providing an unknown field resolver", () => {
      expect(
        () => {
          // eslint-disable-next-line no-new
          new GraphQLMock({
            typeDefs,
            mocks: {
              Mutation: { unvotePost: "This doesn't exists" },
            },
          });
        },
        "to throw",
        "Trying to override unknown field Mutation.unvotePost - did you mean upvotePost"
      );
    });

    it("throw an error when providing a nested unknown field resolver", () => {
      expect(
        () => {
          // eslint-disable-next-line no-new
          new GraphQLMock({
            typeDefs,
            mocks: {
              Mutation: { upvotePost: { unknown: "This doesn't exists" } },
            },
          });
        },
        "to throw",
        "Trying to override unknown field Mutation.upvotePost.Post.unknown"
      );
    });

    it("throw an error when providing an incompatible type for a String resolver", () => {
      expect(
        () => {
          // eslint-disable-next-line no-new
          new GraphQLMock({ typeDefs, mocks: { Post: { title: false } } });
        },
        "to throw",
        "Trying to override Post.title (String) with value: false"
      );
    });

    it("throw an error when providing an incompatible type for a ID resolver", () => {
      expect(
        () => {
          // eslint-disable-next-line no-new
          new GraphQLMock({ typeDefs, mocks: { Post: { id: false } } });
        },
        "to throw",
        "Trying to override Post.id (ID) with value: false"
      );
    });

    it("throw an error when providing an incompatible type for a Float resolver", () => {
      expect(
        () => {
          // eslint-disable-next-line no-new
          new GraphQLMock({ typeDefs, mocks: { Post: { rating: false } } });
        },
        "to throw",
        "Trying to override Post.rating (Float) with value: false"
      );
    });

    it("throw an error when providing null for a non-null resolver", () => {
      expect(
        () => {
          // eslint-disable-next-line no-new
          new GraphQLMock({ typeDefs, mocks: { Post: { id: null } } });
        },
        "to throw",
        "Trying to override Post.id (ID!) with value: null"
      );
    });

    it("throw an error when providing an incompatible type for a Object resolver", () => {
      expect(
        () => {
          // eslint-disable-next-line no-new
          new GraphQLMock({ typeDefs, mocks: { Post: "Incompatible" } });
        },
        "to throw",
        "Trying to override Post with value: Incompatible"
      );
    });

    it("allows overriding nullable resolvers with null", () => {
      expect(() => {
        // eslint-disable-next-line no-new
        new GraphQLMock({
          typeDefs,
          mocks: {
            Post: {
              title: null,
              author: null,
              votes: null,
              rating: null,
            },
          },
        });
      }, "not to throw");
    });

    it("supports an option argument instead of a query and variables", async () => {
      const mock = new GraphQLMock({ typeDefs });
      const result = await mock.execute({
        query: authorNameQuery,
        variables: { id: authorId },
      });

      expect(
        result,
        "to inspect as snapshot",
        "{ data: { author: { firstName: 'herubju', lastName: 'nocpebe', __typename: 'Author' } } }"
      );
    });

    it("supports a query without variables", async () => {
      const mock = new GraphQLMock({ typeDefs });
      const result = await mock.execute(postTitlesQuery);

      expect(
        result,
        "to inspect as snapshot",
        expect.unindent`
        {
          data: {
            posts: [
              { id: '4945079106011136', title: 'herubju', __typename: 'Post' },
              { id: '6325555974635520', title: 'nocpebe', __typename: 'Post' }
            ]
          }
        }
      `
      );
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
          "{ data: { author: { firstName: 'Max Spencer', lastName: 'herubju', __typename: 'Author' } } }"
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
                  id: '4945079106011136', firstName: 'herubju', lastName: 'nocpebe',
                  email: 'kelecse',
                  posts: [
                    { id: '6325555974635520', title: 'jeminode', __typename: 'Post' },
                    { id: '308014672248832', title: 'orimipon', __typename: 'Post' },
                    { id: '1702188611010560', title: 'rurzilru', __typename: 'Post' },
                    { id: '1828976169320448', title: 'My very special title', __typename: 'Post' },
                    { id: '4158848130613248', title: 'lufzipav', __typename: 'Post' }
                  ],
                  __typename: 'Author'
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
          "{ data: { author: { firstName: 'Jane', lastName: 'Doe', __typename: 'Author' } } }"
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
                  id: '6', firstName: 'herubju', lastName: 'nocpebe',
                  email: 'ketis@ziluwi.cw',
                  posts: [
                    { id: '4945079106011136', title: 'kelecse', __typename: 'Post' },
                    { id: '6325555974635520', title: 'jeminode', __typename: 'Post' }
                  ],
                  __typename: 'Author'
                }
              }
            }
          `
        );
      });
    });

    describe("when mocking a list resolver", () => {
      describe("with a mock list", () => {
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
                  id: '4945079106011136', firstName: 'herubju', lastName: 'nocpebe',
                  email: 'ketis@ziluwi.cw',
                  posts: [
                    { id: '6325555974635520', title: 'title-ha', __typename: 'Post' },
                    { id: '308014672248832', title: 'title-felsuh', __typename: 'Post' },
                    { id: '1702188611010560', title: 'title-rizede', __typename: 'Post' }
                  ],
                  __typename: 'Author'
                }
              }
            }
          `
          );
        });
      });

      describe("with an array", () => {
        beforeEach(async () => {
          mock = new GraphQLMock({
            typeDefs,
            mocks: {
              Author: (chance) => ({
                email: chance.email(),
                posts: [{ title: "specific-title" }, {}],
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
                  id: '4945079106011136', firstName: 'herubju', lastName: 'nocpebe',
                  email: 'ketis@ziluwi.cw',
                  posts: [
                    { id: '6325555974635520', title: 'specific-title', __typename: 'Post' },
                    { id: '308014672248832', title: 'title-felsuh', __typename: 'Post' }
                  ],
                  __typename: 'Author'
                }
              }
            }
          `
          );
        });
      });

      it("throw an error when providing an incompatible type for an array resolver", () => {
        expect(
          () => {
            // eslint-disable-next-line no-new
            new GraphQLMock({
              typeDefs,
              mocks: { Author: { posts: "NO" } },
            });
          },
          "to throw",
          "Trying to override Author.posts ([Post!]) with value: NO"
        );
      });

      it("throw an error when providing an incompatible item type for an array resolver", () => {
        expect(
          () => {
            // eslint-disable-next-line no-new
            new GraphQLMock({
              typeDefs,
              mocks: { Author: { posts: [{ unknown: "NO" }] } },
            });
          },
          "to throw",
          "Trying to override unknown field Author.posts[0].Post.unknown"
        );
      });

      it("returns an error when resolving an incompatible item type for an array resolver", async () => {
        const mock = new GraphQLMock({
          typeDefs,
          mocks: { Author: (chance) => ({ posts: [{ unknown: "NO" }] }) },
        });

        const result = await mock.execute(authorQuery, { id: authorId });

        expect(result, "to satisfy", {
          errors: [
            {
              message:
                "Trying to override unknown field Author.posts[0].Post.unknown",
            },
          ],
        });
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
                  id: '4945079106011136', firstName: 'herubju', lastName: 'nocpebe',
                  email: 'kelecse',
                  posts: [
                    { id: '6325555974635520', title: 'jeminode', __typename: 'Post' },
                    { id: '308014672248832', title: 'orimipon', __typename: 'Post' },
                    { id: '1702188611010560', title: 'rurzilru', __typename: 'Post' }
                  ],
                  __typename: 'Author'
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
                  author: { firstName: 'nocpebe', lastName: 'kelecse', __typename: 'Author' },
                  votes: 42,
                  __typename: 'Post'
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
                id: '4945079106011136', firstName: 'Jane', lastName: 'Doe',
                email: 'ketis@ziluwi.cw',
                posts: [
                  { id: '6325555974635520', title: 'title-ha', __typename: 'Post' },
                  { id: '308014672248832', title: 'title-felsuh', __typename: 'Post' },
                  { id: '1702188611010560', title: 'title-rizede', __typename: 'Post' }
                ],
                __typename: 'Author'
              }
            }
          }
        `
      );
    });

    it("throws when the query isn't supported", async () => {
      const mock = new GraphQLMock({ typeDefs });

      const result = await mock.execute(brokenAuthorQuery, { id: authorId });

      expect(result, "to satisfy", {
        errors: [
          {
            message:
              'Cannot query field "emails" on type "Author". Did you mean "email"?',
          },
        ],
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
              id: '4945079106011136', firstName: 'herubju', lastName: 'nocpebe',
              email: 'kelecse',
              posts: [
                { id: '6325555974635520', title: 'foo', __typename: 'Post' },
                { id: '308014672248832', title: 'bar-ketis', __typename: 'Post' },
                { id: '1702188611010560', title: 'baz', __typename: 'Post' },
                { id: '1828976169320448', title: 'foo', __typename: 'Post' },
                { id: '4158848130613248', title: 'bar-ziluwi', __typename: 'Post' }
              ],
              __typename: 'Author'
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
              id: '4945079106011136', firstName: 'herubju', lastName: 'nocpebe',
              email: 'kelecse',
              posts: [
                { id: '6325555974635520', title: 'foo', __typename: 'Post' },
                { id: '308014672248832', title: 'bar', __typename: 'Post' },
                { id: '1702188611010560', title: 'baz-ketis', __typename: 'Post' },
                { id: '1828976169320448', title: 'baz-ziluwi', __typename: 'Post' },
                { id: '4158848130613248', title: 'baz-zev', __typename: 'Post' }
              ],
              __typename: 'Author'
            }
          }
        }
      `
    );
  });
});
