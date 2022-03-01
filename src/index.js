const { makeExecutableSchema } = require("@graphql-tools/schema");
const { addMocksToSchema, MockList } = require("@graphql-tools/mock");
const { graphql } = require("graphql");
const merge = require("lodash/merge");
const mergeWith = require("lodash/mergeWith");
const Chance = require("chance");

const list =
  ({ min = 0, max = 10, length } = {}) =>
  (chance) => {
    if (typeof length !== "number") {
      length = chance.natural({ min, max });
    }

    return new MockList(length);
  };

class GraphQLMock {
  constructor({ typeDefs, overrides, seed = 666 }) {
    const schema = makeExecutableSchema({
      typeDefs,
      resolverValidationOptions: { requireResolversForResolveType: false },
    });

    const defaultChance = new Chance(seed);

    const defaultMocks = {
      Boolean: (chance) => chance.bool(),
      Float: (chance) => chance.floating({ min: -100, max: 100 }),
      Int: (chance) => chance.integer({ min: -100, max: 100 }),
      ID: (chance) => String(chance.natural()),
      String: (chance) => chance.word({ syllables: 3 }),
    };

    const mockArray = [
      defaultMocks,
      ...(Array.isArray(overrides) ? overrides : [overrides]).filter(Boolean),
    ];

    this.schema = addMocksToSchema({
      schema,
      mocks: mergeWith(
        ...mockArray.map((mocks) => {
          Object.keys(mocks).forEach((key) => {
            const mock = mocks[key];

            if (typeof mock === "function") {
              const chance = new Chance(defaultChance.natural());

              mocks[key] = (root, args, context, info) =>
                mock(chance, root, args, context, info);
            } else {
              mocks[key] = (root, args, context, info) => mock;
            }
          });

          return mocks;
        }),
        (a, b) => {
          if (a && b) {
            return (...args) => {
              const aResult = a(...args);
              const bResult = b(...args);

              if (bResult === null) {
                return bResult;
              }

              if (Array.isArray(bResult)) {
                return bResult;
              }

              return merge(aResult, bResult);
            };
          }

          return b || a;
        }
      ),
    });
  }

  execute(query, variables) {
    return graphql({
      schema: this.schema,
      source: query,
      variableValues: variables,
    });
  }
}

module.exports = {
  GraphQLMock,
  list,
};
