const expect = require("unexpected")
  .clone()
  .use(require("unexpected-snapshot"));

const {
  GraphQLMock,
  list,
  connection,
  cycle,
  values,
} = require("../src/index.js");

const typeDefs = `
  type Author {
    id: ID!
    firstName: String!
    lastName: String!
    email: String
    posts: [Post!]
    favoritePost: Post
  }

  enum Endorsement {
    LOVE
    LIKE
    DISLIKE
  }

  type Comment {
    id: ID!
    text: String!
    endorsementCount(type: Endorsement!): Int!
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
    author: Author
    votes: Int
    rating: Float
    comments(
      first: Int
      last: Int
      after: String
      before: String
    ): CommentConnection!
  }

  type Query {
    posts: [Post]
    post(id: ID!): Post
    author(id: ID!): Author
    randomInt(seed: Int): Int
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
        votes
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

  describe("constructor", () => {
    it("doesn't modify the incoming mocks", () => {
      const authorMock = {
        id: "author-0",
        firstName: "Jane",
        lastName: "Doe",
      };
      const mocks = {
        Author: authorMock,
      };

      // eslint-disable-next-line no-new
      new GraphQLMock({ typeDefs, mocks });
      // eslint-disable-next-line no-new
      new GraphQLMock({ typeDefs, mocks });

      expect(mocks.Author, "to be", authorMock);
    });
  });

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
              Mutation: {
                upvotePost: { id: "post-0", unknown: "This doesn't exists" },
              },
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
          new GraphQLMock({
            typeDefs,
            mocks: { Post: { id: "id", title: false } },
          });
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

    it("throw an error when providing an incompatible type for a Int resolver", () => {
      expect(
        () => {
          // eslint-disable-next-line no-new
          new GraphQLMock({
            typeDefs,
            mocks: { Post: { id: "id", votes: false } },
          });
        },
        "to throw",
        "Trying to override Post.votes (Int) with value: false"
      );
    });

    it("throw an error when providing an incompatible type for a Float resolver", () => {
      expect(
        () => {
          // eslint-disable-next-line no-new
          new GraphQLMock({
            typeDefs,
            mocks: { Post: { id: "id", rating: false } },
          });
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
              id: "id",
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
              id: "author-0",
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
            Author: { id: "author-0", posts: [] },
            Post: (chance, seq) =>
              seq === 3
                ? { id: `post-${seq}`, title: "My very special title" }
                : { id: `post-${seq}` },
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
                  id: 'author-0', firstName: 'herubju', lastName: 'nocpebe', email: 'kelecse',
                  posts: [], __typename: 'Author'
                }
              }
            }
          `
        );
      });
    });

    describe("mocking a resolver on an object", () => {
      beforeEach(() => {
        mock = new GraphQLMock({
          typeDefs,
          mocks: {
            Query: {
              randomInt: 0,
            },
          },
        });
      });

      const randomIntQuery = `
        query randomIntQuery {
          randomInt
        }
      `;

      it("uses the provided result will be used", async () => {
        const result = await mock.execute(randomIntQuery);

        expect(result, "to inspect as snapshot", "{ data: { randomInt: 0 } }");
      });
    });

    describe("when hardcoding a field on an object", () => {
      beforeEach(async () => {
        mock = new GraphQLMock({
          typeDefs,
          mocks: {
            Author: {
              id: "author-0",
              firstName: "Jane",
              lastName: "Doe",
              posts: [
                { id: "post-0", title: "First post", votes: 0 },
                { id: "post-1", votes: 3 },
              ],
            },
          },
        });
      });

      it("the mocked field will be used", async () => {
        const result = await mock.execute(authorQuery, { id: authorId });

        expect(
          result,
          "to inspect as snapshot",
          expect.unindent`
            {
              data: {
                author: {
                  id: 'author-0', firstName: 'Jane', lastName: 'Doe', email: 'herubju',
                  posts: [
                    { id: 'post-0', title: 'First post', votes: 0, __typename: 'Post' },
                    { id: 'post-1', title: 'nocpebe', votes: 3, __typename: 'Post' }
                  ],
                  __typename: 'Author'
                }
              }
            }
          `
        );
      });
    });

    describe("when override the default resolvers", () => {
      beforeEach(async () => {
        mock = new GraphQLMock({
          typeDefs,
          mocks: {
            Author: (chance) => ({
              id: "author-0",
              email: chance.email(),
            }),
            Post: { id: "id", votes: 0 },
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
                    { id: 'id', title: 'kelecse', votes: 0, __typename: 'Post' },
                    { id: 'id', title: 'kelecse', votes: 0, __typename: 'Post' }
                  ],
                  __typename: 'Author'
                }
              }
            }
          `
        );
      });
    });

    describe("when mocking a list resolver with an array", () => {
      beforeEach(async () => {
        mock = new GraphQLMock({
          typeDefs,
          mocks: {
            Author: (chance) => ({
              id: "author-0",
              email: chance.email(),
              posts: [
                { id: "post-1", title: "specific-title" },
                { id: "post-2" },
              ],
            }),
            Post: (chance) => ({
              id: "post-0",
              title: `title-${chance.word()}`,
              votes: 0,
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
                  id: 'author-0', firstName: 'herubju', lastName: 'nocpebe',
                  email: 'ketis@ziluwi.cw',
                  posts: [
                    { id: 'post-1', title: 'specific-title', votes: 0, __typename: 'Post' },
                    { id: 'post-2', title: 'title-felsuh', votes: 0, __typename: 'Post' }
                  ],
                  __typename: 'Author'
                }
              }
            }
          `
        );
      });

      it("throw an error when providing an incompatible type for an array resolver", () => {
        expect(
          () => {
            // eslint-disable-next-line no-new
            new GraphQLMock({
              typeDefs,
              mocks: { Author: { id: "author-0", posts: "NO" } },
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
              mocks: {
                Author: {
                  id: "author-0",
                  posts: [{ id: "post-0", unknown: "NO" }],
                },
              },
            });
          },
          "to throw",
          "Trying to override unknown field Author.posts[0].Post.unknown"
        );
      });

      it("returns an error when resolving an incompatible item type for an array resolver", async () => {
        const mock = new GraphQLMock({
          typeDefs,
          mocks: {
            Author: (chance) => ({
              id: "author-0",
              posts: [{ id: "post-0", unknown: "NO" }],
            }),
          },
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

    describe("when executing a mutation", () => {
      beforeEach(async () => {
        mock = new GraphQLMock({
          typeDefs,
          mocks: {
            Mutation: {
              upvotePost: {
                id: "post-0",
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
                  id: chance.guid(),
                  email: chance.email(),
                  posts: [{}, {}, {}],
                }),
                Post: (chance) => ({
                  id: chance.guid(),
                  title: `title-${chance.word()}`,
                  votes: 0,
                }),
              },
              mocks,
            ],
          });
        }
      }

      const mock = new MyMock({
        Author: (chance) => ({
          id: "author-0",
          firstName: "Jane",
          lastName: "Doe",
          posts: [{ id: "my-post", title: "Arrays override", votes: 42 }, {}],
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
                id: 'author-0', firstName: 'Jane', lastName: 'Doe',
                email: 'hunmap@cuwcodbo.su',
                posts: [
                  { id: 'my-post', title: 'Arrays override', votes: 42, __typename: 'Post' },
                  {
                    id: 'cedc44ce-2648-5f34-8300-8cec72982034',
                    title: 'title-jahnul',
                    votes: 0,
                    __typename: 'Post'
                  }
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

    describe("mocking with a nested structure", () => {
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
              comments {
                edges {
                  node {
                    id
                    text
                  }
                }
              }
            }
          }
        }
      `;

      it("uses the entire provided structure", async () => {
        const mock = new GraphQLMock({
          typeDefs,
          mocks: {
            Query: {
              author: {
                id: "author-0",
                posts: [
                  {
                    id: "post-0",
                    title: "post-0",
                    comments: {
                      edges: [
                        {
                          node: {
                            id: "comment-0",
                            text: "comment-0",
                          },
                        },
                        {
                          node: {
                            id: "comment-1",
                            text: "comment-1",
                          },
                        },
                      ],
                    },
                  },
                  {
                    id: "post-1",
                    title: "post-1",
                    comments: {
                      edges: [
                        {
                          node: {
                            id: "comment-2",
                            text: "comment-2",
                          },
                        },
                        {
                          node: {
                            id: "comment-3",
                            text: "comment-3",
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
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
                  id: 'author-0', firstName: 'herubju', lastName: 'nocpebe', email: 'kelecse',
                  posts: [
                    {
                      id: 'post-0',
                      title: 'post-0',
                      comments: {
                        edges: [
                          {
                            node: { id: 'comment-0', text: 'comment-0', __typename: 'Comment' },
                            __typename: 'CommentConnectionEdge'
                          },
                          {
                            node: { id: 'comment-1', text: 'comment-1', __typename: 'Comment' },
                            __typename: 'CommentConnectionEdge'
                          }
                        ],
                        __typename: 'CommentConnection'
                      },
                      __typename: 'Post'
                    },
                    {
                      id: 'post-1',
                      title: 'post-1',
                      comments: {
                        edges: [
                          {
                            node: { id: 'comment-2', text: 'comment-2', __typename: 'Comment' },
                            __typename: 'CommentConnectionEdge'
                          },
                          {
                            node: { id: 'comment-3', text: 'comment-3', __typename: 'Comment' },
                            __typename: 'CommentConnectionEdge'
                          }
                        ],
                        __typename: 'CommentConnection'
                      },
                      __typename: 'Post'
                    }
                  ],
                  __typename: 'Author'
                }
              }
            }
          `
        );
      });
    });
  });
});

describe("list", () => {
  let mock;

  describe("with specific length", () => {
    beforeEach(async () => {
      mock = new GraphQLMock({
        typeDefs,
        mocks: {
          Author: (chance) => ({
            id: "author-0",
            email: chance.email(),
            posts: list(3),
          }),
          Post: (chance) => ({
            id: "post-0",
            title: `title-${chance.word()}`,
            votes: 0,
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
                id: 'author-0', firstName: 'herubju', lastName: 'nocpebe',
                email: 'ketis@ziluwi.cw',
                posts: [
                  { id: 'post-0', title: 'title-rizede', votes: 0, __typename: 'Post' },
                  { id: 'post-0', title: 'title-rizede', votes: 0, __typename: 'Post' },
                  { id: 'post-0', title: 'title-rizede', votes: 0, __typename: 'Post' }
                ],
                __typename: 'Author'
              }
            }
          }
        `
      );
    });
  });

  describe("with variable length", () => {
    beforeEach(async () => {
      mock = new GraphQLMock({
        typeDefs,
        mocks: {
          Author: (chance) => ({
            id: "author-0",
            posts: list(chance.integer({ min: 1, max: 5 })),
          }),
          Post: (chance) => ({
            id: String(chance.natural()),
            votes: 0,
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
                id: 'author-0', firstName: 'herubju', lastName: 'nocpebe', email: 'kelecse',
                posts: [
                  { id: '1240024668438528', title: 'jeminode', votes: 0, __typename: 'Post' },
                  { id: '2451287534731264', title: 'orimipon', votes: 0, __typename: 'Post' },
                  { id: '2247633177411584', title: 'rurzilru', votes: 0, __typename: 'Post' }
                ],
                __typename: 'Author'
              }
            }
          }
        `
      );
    });
  });
});

describe("cycle", () => {
  let mock;

  beforeEach(async () => {
    mock = new GraphQLMock({
      typeDefs,
      mocks: {
        Author: { id: "author-0", posts: list(5) },
        Post: cycle(
          { id: "post-0", title: "foo" },
          (chance) => ({ id: "post-1", title: `bar-${chance.word()}` }),
          { id: "post-2", title: "baz" }
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
              id: 'author-0', firstName: 'herubju', lastName: 'nocpebe', email: 'kelecse',
              posts: [
                { id: 'post-0', title: 'foo', votes: -25, __typename: 'Post' },
                { id: 'post-1', title: 'bar-ziluwi', votes: -46, __typename: 'Post' },
                { id: 'post-2', title: 'baz', votes: -58, __typename: 'Post' },
                { id: 'post-0', title: 'foo', votes: -25, __typename: 'Post' },
                { id: 'post-1', title: 'bar-ziluwi', votes: -46, __typename: 'Post' }
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
        Author: { id: "author-0", posts: list(5) },
        Post: values(
          { id: "post-0", title: "foo" },
          { id: "post-1", title: "bar" },
          (chance) => ({
            id: `id-${chance.guid()}`,
            title: `baz-${chance.word()}`,
          })
        ),
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
              id: 'author-0', firstName: 'herubju', lastName: 'nocpebe', email: 'kelecse',
              posts: [
                { id: 'post-0', title: 'foo', votes: -25, __typename: 'Post' },
                { id: 'post-1', title: 'bar', votes: -46, __typename: 'Post' },
                {
                  id: 'id-29f18c97-0d71-5cf8-a63d-97f9191765b2',
                  title: 'baz-hunmap',
                  votes: -58,
                  __typename: 'Post'
                },
                {
                  id: 'id-08b890b4-c2a4-5882-ac8d-d1c66bca694c',
                  title: 'baz-ituse',
                  votes: -72,
                  __typename: 'Post'
                },
                {
                  id: 'id-451d947d-2f4c-525b-b04d-0a792234cbcf',
                  title: 'baz-wazzef',
                  votes: -34,
                  __typename: 'Post'
                }
              ],
              __typename: 'Author'
            }
          }
        }
      `
    );
  });
});

describe("connection", () => {
  let mock;

  describe("with default options ", () => {
    it("returns a total field", () => {
      expect(connection(5, { includeTotal: true }), "to equal snapshot", {
        edges: [
          { cursor: "cursor-0" },
          { cursor: "cursor-1" },
          { cursor: "cursor-2" },
          { cursor: "cursor-3" },
          { cursor: "cursor-4" },
        ],
        pageInfo: {
          hasNextPage: true,
          hasPreviousPage: false,
          endCursor: "cursor-4",
          startCursor: "cursor-0",
        },
        total: 5,
      });
    });
  });

  describe("with includeTotal=true", () => {
    it("returns a total field", () => {
      expect(connection(5, { includeTotal: true }), "to satisfy", {
        total: 5,
      });
    });
  });

  describe("with hasNextPage=false", () => {
    it("sets hasNextPage to false", () => {
      expect(connection(5, { hasNextPage: false }), "to satisfy", {
        pageInfo: { hasNextPage: false },
      });
    });
  });

  describe("with hasPreviousPage=true", () => {
    it("sets hasPreviousPage to true", () => {
      expect(connection(5, { hasPreviousPage: true }), "to satisfy", {
        pageInfo: { hasPreviousPage: true },
      });
    });
  });

  describe("when mocking a Relay connection resolver", () => {
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

    beforeEach(async () => {
      mock = new GraphQLMock({
        typeDefs,
        mocks: {
          Query: {
            posts: list(1),
          },
          CommentConnection: connection(1, { includeTotal: true }),
        },
      });
    });

    it("returns the specified number of items in the connection", async () => {
      const result = await mock.execute(postsQuery);

      expect(
        result,
        "to inspect as snapshot",
        expect.unindent`
          {
            data: {
              posts: [
                {
                  id: '4945079106011136',
                  title: 'herubju',
                  comments: {
                    edges: [
                      {
                        cursor: 'cursor-0',
                        node: { id: '6325555974635520', text: 'nocpebe', __typename: 'Comment' },
                        __typename: 'CommentConnectionEdge'
                      }
                    ],
                    pageInfo: {
                      hasNextPage: true,
                      hasPreviousPage: false,
                      endCursor: 'cursor-0',
                      __typename: 'PageInfo'
                    },
                    total: 1,
                    __typename: 'CommentConnection'
                  },
                  __typename: 'Post'
                }
              ]
            }
          }
        `
      );
    });
  });

  describe("when mocking a Relay connection resolver to zero items", () => {
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

    beforeEach(async () => {
      mock = new GraphQLMock({
        typeDefs,
        mocks: {
          Query: {
            posts: list(1),
          },
          CommentConnection: connection(0, { includeTotal: true }),
        },
      });
    });

    it("returns the specified zero of items in the connection", async () => {
      const result = await mock.execute(postsQuery);

      expect(
        result,
        "to inspect as snapshot",
        expect.unindent`
        {
          data: {
            posts: [
              {
                id: '4945079106011136',
                title: 'herubju',
                comments: {
                  edges: [],
                  pageInfo: {
                    hasNextPage: true,
                    hasPreviousPage: false,
                    endCursor: null,
                    __typename: 'PageInfo'
                  },
                  total: 0,
                  __typename: 'CommentConnection'
                },
                __typename: 'Post'
              }
            ]
          }
        }
      `
      );
    });
  });
});

it("passes regression test for issue #103", async () => {
  const mock = new GraphQLMock({
    typeDefs,
    mocks: [
      {
        Query: {
          post: {
            id: "post-0",
            comments: {
              edges: [
                { node: { id: "comment-0", endorsementCount: 0 } },
                { node: { id: "comment-1", endorsementCount: 10 } },
                { node: { id: "comment-2", endorsementCount: 42 } },
              ],
            },
          },
        },
      },
    ],
  });

  const postCommentsQuery = `
      query postComments($id: ID!) {
        post(id: $id) {
          comments {
            edges {
              node {
                id
                endorsementCount(type: LIKE)
              }
            }
          }
        }
      }
    `;

  const result = await mock.execute(postCommentsQuery, { id: "post-0" });

  expect(
    result,
    "to inspect as snapshot",
    expect.unindent`
        {
          data: {
            post: {
              comments: {
                edges: [
                  {
                    node: { id: 'comment-0', endorsementCount: 0, __typename: 'Comment' },
                    __typename: 'CommentConnectionEdge'
                  },
                  {
                    node: { id: 'comment-1', endorsementCount: 10, __typename: 'Comment' },
                    __typename: 'CommentConnectionEdge'
                  },
                  {
                    node: { id: 'comment-2', endorsementCount: 42, __typename: 'Comment' },
                    __typename: 'CommentConnectionEdge'
                  }
                ],
                __typename: 'CommentConnection'
              },
              __typename: 'Post'
            }
          }
        }
      `
  );
});
