const { makeExecutableSchema } = require("@graphql-tools/schema");
const { addTypenameToDocument } = require("@apollo/client/utilities");
const ukkonen = require("ukkonen");

const {
  addMocksToSchema,
  createMockStore,
  MockList,
  isMockList,
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

const connection = (length, options = {}) => {
  const {
    hasPreviousPage = false,
    hasNextPage = true,
    includeTotal = false,
  } = options;

  const edges = [];

  for (let i = 0; i < length; i++) {
    edges.push({
      cursor: `cursor-${i}`,
    });
  }

  let startCursor, endCursor;

  if (length > 0) {
    startCursor = edges[0].cursor;
    endCursor = edges[edges.length - 1].cursor;
  }

  return {
    edges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      endCursor,
      startCursor,
    },
    ...(includeTotal ? { total: length } : {}),
  };
};

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

const createHint = ({ possibleNames, name }) => {
  const scoredNames = possibleNames
    .map((possibleName) => ({
      name: possibleName,
      score: ukkonen(name, possibleName),
    }))
    .filter(({ score }) => score <= 3);

  if (scoredNames.length > 0) {
    scoredNames.sort(({ score: a }, { score: b }) => a - b);

    return ` - did you mean ${scoredNames[0].name}`;
  }

  return "";
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
      {},
      defaultMocks,
      ...(Array.isArray(mocks) ? mocks : [mocks]).filter(Boolean),
    ].map((mocks) =>
      Object.fromEntries(
        Object.entries(mocks).map(([typeName, mock]) => {
          if (typeof mock === "function") {
            const chance = new Chance(this._chance.natural());
            let seq = 0;

            return [
              typeName,
              () => {
                const data = mock(chance, seq++);

                this._validateDataAgainstTypeName({
                  schema,
                  data,
                  typeName,
                });

                return data;
              },
            ];
          } else {
            this._validateDataAgainstTypeName({
              schema,
              data: mock,
              typeName,
            });

            return [typeName, () => mock];
          }
        })
      )
    );

    const mergedMocks = mergeWith(...mockArray, (a, b) => {
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
    });

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
    const typeMap = schema.getTypeMap();
    const type = typeMap[typeName];

    if (type) {
      this._validateDataAgainstType({ schema, data, type });
    } else if (!defaultMocks[typeName]) {
      const hint = createHint({
        possibleNames: [...Object.keys(typeMap), ...Object.keys(defaultMocks)],
        name: typeName,
      });

      throw new Error(`Trying to override unknown type: ${typeName}${hint}`);
    }
  }

  _validateDataAgainstType({ schema, data, type, context }) {
    if (data == null) {
      if (type instanceof GraphQLNonNull) {
        throw new Error(
          `Trying to override ${context} (${type}) with value: ${data}`
        );
      }
    } else if (type instanceof GraphQLNonNull) {
      this._validateDataAgainstType({
        schema,
        type: type.ofType,
        data,
        context,
      });
    } else if (type instanceof GraphQLObjectType) {
      if (typeof data !== "object") {
        if (context) {
          throw new Error(
            `Trying to override ${context} (${type}) with value: ${data}`
          );
        } else {
          throw new Error(`Trying to override ${type} with value: ${data}`);
        }
      }

      const fields = type.getFields();

      context = context ? `${context}.${type.name}` : type.name;

      if ("id" in fields && !("id" in data)) {
        throw new Error(`No id specified for ${context}`);
      }

      Object.entries(data).forEach(([fieldName, value]) => {
        const field = fields[fieldName];

        if (!field) {
          const hint = createHint({
            possibleNames: Object.keys(fields),
            name: fieldName,
          });

          throw new Error(
            `Trying to override unknown field ${context}.${fieldName}${hint}`
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
  connection,
  cycle,
  values,
};
