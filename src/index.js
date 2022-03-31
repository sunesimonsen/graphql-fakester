const { makeExecutableSchema } = require("@graphql-tools/schema");
const { addTypenameToDocument } = require("@apollo/client/utilities");

const {
  addMocksToSchema,
  createMockStore,
  MockList,
} = require("@graphql-tools/mock");

const { graphql, print, parse } = require("graphql");
const merge = require("lodash/merge");
const mergeWith = require("lodash/mergeWith");
const Chance = require("chance");

const list = (length) => new MockList(length);

const values =
  (...mocks) =>
  (chance, seq) => {
    const mock = mocks[Math.min(seq, mocks.length - 1)];

    return typeof mock === "function" ? mock(chance, seq) : mock;
  };

const cycle =
  (...mocks) =>
  (chance, seq) => {
    const mock = mocks[seq % mocks.length];

    return typeof mock === "function" ? mock(chance, seq) : mock;
  };

const isRef = (value) => value && value.$ref;
const isRefArray = (value) => Array.isArray(value) && value.some(isRef);

class GraphQLMock {
  constructor({ typeDefs, mocks, resolvers, seed = 666 }) {
    const schema = makeExecutableSchema({
      typeDefs,
      resolverValidationOptions: { requireResolversForResolveType: false },
    });

    this._nextKey = 0;
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
            let seq = 0;

            mocks[key] = () => mock(chance, seq++);
          } else {
            mocks[key] = () => mock;
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

  getType(
    typeName,
    key = this._nextKey++,
    { depth = 2, likelihood = 80 } = {}
  ) {
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

  execute(...args) {
    let query, variables;

    if (args.length === 1) {
      query = args.query;
      variables = args.variables;
    } else {
      query = args[0];
      variables = args[1];
    }

    const parsedQuery = addTypenameToDocument(
      typeof query === "string" ? parse(query) : query
    );

    return graphql({
      schema: this.schema,
      source: print(parsedQuery),
      variableValues: variables,
    });
  }
}

module.exports = {
  GraphQLMock,
  list,
  cycle,
  values,
};
