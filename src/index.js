const { makeExecutableSchema } = require("@graphql-tools/schema");

const {
  addMocksToSchema,
  createMockStore,
  MockList,
} = require("@graphql-tools/mock");

const { graphql, print } = require("graphql");
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

const isRef = (value) => value && value.$ref;
const isRefArray = (value) => Array.isArray(value) && value.some(isRef);

class GraphQLMock {
  constructor({ typeDefs, mocks, resolvers, seed = 666 }) {
    const schema = makeExecutableSchema({
      typeDefs,
      resolverValidationOptions: { requireResolversForResolveType: false },
    });

    this._cache = new Map();
    this._chance = new Chance(seed);

    const defaultMocks = {
      Boolean: (chance) => chance.bool(),
      Float: (chance) => chance.floating({ min: -100, max: 100 }),
      Int: (chance) => chance.integer({ min: -100, max: 100 }),
      ID: (chance) => String(chance.natural()),
      String: (chance) => chance.word({ syllables: 3 }),
    };

    const mockArray = [
      defaultMocks,
      ...(Array.isArray(mocks) ? mocks : [mocks]).filter(Boolean),
    ];

    const mergedMocks = mergeWith(
      ...mockArray.map((mocks) => {
        Object.keys(mocks).forEach((key) => {
          const mock = mocks[key];

          if (typeof mock === "function") {
            const chance = new Chance(this._chance.natural());

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
    );

    this.mockStore = createMockStore({
      schema,
      mocks: mergedMocks,
    });

    this.schema = addMocksToSchema({
      schema,
      resolvers,
      store: this.mockStore,
      mocks: mergedMocks,
    });
  }

  _resolveRef(value, options) {
    if (isRef(value)) {
      return this.getType(value.$ref.typeName, value.$ref.key, options);
    } else {
      return value;
    }
  }

  getType(typeName, key, { depth = 2, likelihood = 80 } = {}) {
    const cacheKey = `${typeName}:${key}:${depth}:${likelihood}`;

    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const type = this.schema.getType(typeName);

    if (!type) {
      throw new Error(`Unknown type: ${typeName}`);
    }

    const fields = type.getFields();

    const result = { __typename: typeName };

    for (const [fieldName, field] of Object.entries(fields)) {
      if (
        field.type.toString().endsWith("!") ||
        this._chance.bool({ likelihood })
      ) {
        const stubbedField = this.mockStore.get(type.name, key, fieldName);

        if (isRefArray(stubbedField)) {
          if (depth > 0) {
            result[fieldName] = stubbedField.map((value) =>
              this._resolveRef(value, { depth: depth - 1, likelihood })
            );
          }
        } else if (isRef(stubbedField)) {
          if (depth > 0) {
            result[fieldName] = this._resolveRef(stubbedField, {
              depth: depth - 1,
              likelihood,
            });
          }
        } else {
          result[fieldName] = stubbedField;
        }
      }
    }

    this._cache.set(cacheKey, result);

    return result;
  }

  execute(query, variables) {
    return graphql({
      schema: this.schema,
      source: typeof query === "string" ? query : print(query),
      variableValues: variables,
    });
  }
}

module.exports = {
  GraphQLMock,
  list,
};
