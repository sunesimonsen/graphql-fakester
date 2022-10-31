const { makeExecutableSchema } = require("@graphql-tools/schema");
const { addTypenameToDocument } = require("@apollo/client/utilities");

const {
  addMocksToSchema,
  createMockStore,
  MockList,
} = require("@graphql-tools/mock");

const {
  graphql,
  print,
  parse,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLNonNull,
  GraphQLList,
} = require("graphql");

const merge = require("lodash/merge");
const mergeWith = require("lodash/mergeWith");
const Chance = require("chance");

const list = (length) => new MockList(length);
const isMockList = (value) => value && value instanceof MockList;

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

const normalizeExecuteArgs = (args) =>
  args.length === 1 && args[0].query
    ? args[0]
    : { query: args[0], variables: args[1] };

const defaultMocks = {
  Boolean: (chance) => chance.bool(),
  Float: (chance) => chance.floating({ min: -100, max: 100 }),
  Int: (chance) => chance.integer({ min: -100, max: 100 }),
  ID: (chance) => String(chance.natural()),
  String: (chance) => chance.word({ syllables: 3 }),
};

class GraphQLMock {
  constructor({ typeDefs, mocks, resolvers, seed = 666 }) {
    const schema = makeExecutableSchema({
      typeDefs,
      resolverValidationOptions: { requireResolversForResolveType: false },
    });

    this._nextKey = 0;
    this._cache = new Map();
    this._chance = new Chance(seed);

    const mockArray = [
      { ...defaultMocks },
      ...(Array.isArray(mocks) ? mocks : [mocks]).filter(Boolean),
    ];

    const mergedMocks = mergeWith(
      ...mockArray.map((mocks) => {
        Object.keys(mocks).forEach((typeName) => {
          const mock = mocks[typeName];

          if (typeof mock === "function") {
            const chance = new Chance(this._chance.natural());
            let seq = 0;

            mocks[typeName] = () => {
              const data = mock(chance, seq++);

              this._validateDataAgainstTypeName({
                schema,
                data,
                typeName: typeName,
              });

              return data;
            };
          } else {
            this._validateDataAgainstTypeName({
              schema,
              data: mock,
              typeName: typeName,
            });

            mocks[typeName] = () => mock;
          }
        });

        return mocks;
      }),
      (a, b) => {
        if (a && b) {
          return (...args) => {
            const bResult = b(...args);

            if (bResult === null) {
              return bResult;
            }

            if (Array.isArray(bResult)) {
              return bResult;
            }

            const aResult = a(...args);

            return merge(aResult, bResult);
          };
        }

        return b || a;
      }
    );

    this._validateMocksAgainstSchema({ mocks: mergedMocks, schema });

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

  _validateMocksAgainstSchema({ mocks, schema }) {
    const typeMap = schema.getTypeMap();
    Object.keys(mocks).forEach((typeName) => {
      const type = typeMap[typeName] || defaultMocks[typeName];

      if (!type) {
        throw new Error(`Trying to override unknown type: ${typeName}`);
      }
    });
  }

  _validateDataAgainstTypeName({ schema, data, typeName }) {
    const type = schema.getType(typeName);

    if (!type) {
      throw new Error(`Trying to override unknown type: ${typeName}`);
    }

    this._validateDataAgainstType({ schema, data, type });
  }

  _validateDataAgainstType({ schema, data, type, context }) {
    if (type instanceof GraphQLObjectType) {
      const fields = type.getFields();

      context = context ? `${context}.${type.name}` : type.name;

      Object.entries(data).forEach(([fieldName, value]) => {
        const field = fields[fieldName];

        if (!field) {
          throw new Error(
            `Trying to override unknown field ${context}.${fieldName}`
          );
        }

        this._validateDataAgainstType({
          schema,
          data: value,
          type: field.type,
          context: `${context}.${fieldName}`,
        });
      });
    } else if (type instanceof GraphQLScalarType) {
      if (["String", "ID"].includes(type.name)) {
        if (typeof data !== "string") {
          throw new Error(
            `Trying to override ${context} (${type}) with value: ${data}`
          );
        }
      } else if (type.name === "Int") {
        if (typeof data !== "number" || data % 1 !== 0) {
          throw new Error(
            `Trying to override ${context} (${type}) with value: ${data}`
          );
        }
      } else if (type.name === "Float") {
        if (typeof data !== "number") {
          throw new Error(
            `Trying to override ${context} (${type}) with value: ${data}`
          );
        }
      } else if (type.name === "Boolean") {
        if (typeof data !== "boolean") {
          throw new Error(
            `Trying to override ${context} (${type}) with value: ${data}`
          );
        }
      }
    } else if (type instanceof GraphQLNonNull) {
      if (data == null) {
        throw new Error(
          `Trying to override ${context} (${type}) with value: ${data}`
        );
      }

      this._validateDataAgainstType({
        schema,
        type: type.ofType,
        data,
        context,
      });
    } else if (type instanceof GraphQLList) {
      if (Array.isArray(data)) {
        data.forEach((item, i) => {
          this._validateDataAgainstType({
            schema,
            type: type.ofType,
            data: item,
            context: `${context}[${i}]`,
          });
        });
      } else if (!isMockList(data)) {
        throw new Error(
          `Trying to override ${context} (${type}) with value: ${data}`
        );
      }
    }
  }

  _resolveRef(value, options) {
    if (isRef(value)) {
      return this.getType(value.$ref.typeName, value.$ref.fieldName, options);
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
    const { query, variables } = normalizeExecuteArgs(args);

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
