import CustomStore from "devextreme/data/custom_store";
import { RequestQueryBuilder, CondOperator } from "@nestjsx/crud-request";

const SEARCH_OPS = {
  and: ["$and", "$or"],
  or: ["$or", "$and"],
  "=": [CondOperator.EQUALS, CondOperator.NOT_EQUALS],
  "<>": [CondOperator.NOT_EQUALS, CondOperator.EQUALS],
  ">": [CondOperator.GREATER_THAN, CondOperator.LOWER_THAN_EQUALS],
  ">=": [CondOperator.GREATER_THAN_EQUALS, CondOperator.LOWER_THAN],
  "<": [CondOperator.LOWER_THAN, CondOperator.GREATER_THAN_EQUALS],
  "<=": [CondOperator.LOWER_THAN_EQUALS, CondOperator.GREATER_THAN],
  startswith: [CondOperator.STARTS, CondOperator.EXCLUDES], // cannot be properly negated
  endswith: [CondOperator.ENDS, CondOperator.EXCLUDES], // cannot be properly negated
  contains: [CondOperator.CONTAINS, CondOperator.EXCLUDES],
  notcontains: [CondOperator.EXCLUDES, CondOperator.CONTAINS],
};

export default function (options) {
  if (typeof options === "string") {
    options = { url: options };
  }

  return new CustomStore({
    ...options,
    key: options.key || "id",
    useDefaultSearch: true,

    async load(loadOptions) {
      const query = buildQuery(loadOptions);
      const response = await fetchData(`${options.url}?${query}`);
      return {
        data: response.data,
        totalCount: response.total,
      };
    },

    async byKey(key) {
      const query = buildQuery({ filter: { [options.key]: key } });
      const response = await fetchData(`${options.url}?${query}`);
      return {
        data: response.data,
        totalCount: response.total,
      };
    },

    async insert(values) {
      return await postData(options.url, values);
    },

    async remove(key) {
      return await deleteData(options.url, key);
    },

    async update(key, values) {
      return await updateData(options.url, key, values);
    },

    async totalCount(loadOptions) {
      const query = buildQuery({ ...loadOptions, take: 1 });
      const response = await fetchData(`${options.url}?${query}`);
      return response.total;
    },
  });
}

function getOp(op, negate) {
  return SEARCH_OPS[op][negate ? 1 : 0];
}

function buildQuery(loadOptions) {
  // console.log(loadOptions);
  return RequestQueryBuilder.create()
    .search(createSearch(loadOptions.filter))
    .select(loadOptions.select)
    .sortBy(createSort(loadOptions.sort))
    .setOffset(loadOptions.skip)
    .setLimit(loadOptions.take)
    .query();
}

function createSearch(filter, negate = false) {
  if (!Array.isArray(filter)) return filter;

  const unary = (v) =>
    v[0] === "!" ? createSearch(v[1], !negate) : complex([v[0], "and", v[1]]);

  const binary = (v) =>
    ["or", "and"].includes(v[1])
      ? complex(v)
      : {
          [v[0]]: {
            [getOp(v[1], negate)]: createSearch(v[2], negate),
          },
        };

  const complex = (v) => ({
    [getOp(v[1], negate)]: [
      createSearch(v[0], negate),
      createSearch(v[2], negate),
    ],
  });

  switch (filter.length) {
    case 1:
      return createSearch(filter);

    case 2:
      return unary(filter);

    case 3:
      return binary(filter);

    default:
      return null;
  }
}

function createSort(sort) {
  if (!sort) return;
  if (!Array.isArray(sort)) sort = [sort];
  return sort.map((s) =>
    typeof s === "string"
      ? { field: s }
      : typeof s === "object"
      ? { field: s.selector, order: s.desc ? "DESC" : "ASC" }
      : null
  );
}

async function fetchData(url) {
  try {
    const response = await fetch(url);
    return await handleResponse(response);
  } catch (e) {
    throw "Network error " + e;
  }
}

async function postData(url, values) {
  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(values),
      headers: {
        "Content-Type": "application/json",
      },
    });
    return handleResponse(response);
  } catch (e) {
    throw "Network error " + e;
  }
}

async function deleteData(url, key) {
  try {
    const response = await fetch(`${url}/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    // handleError(response);
    // return true;
    return handleResponse(response);
  } catch (e) {
    throw "Network error " + e;
  }
}

async function updateData(url, key, values) {
  try {
    const response = await fetch(`${url}/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify(values),
      headers: {
        "Content-Type": "application/json",
      },
    });
    return handleResponse(response);
  } catch (e) {
    throw "Network error " + e;
  }
}

async function handleError(response) {
  if (response.ok) return response;

  try {
    const error = await response.json();
    throw Error(error);
  } catch (e) {
    throw Error(response.statusText);
  }
}

async function handleResponse(response) {
  handleError(response);
  return await response.json();
}
