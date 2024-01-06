const getPagination = (req, count, page, limit) => {
  let result = {};
  let link = {};
  let path = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}?`;

  // Extracting query parameters
  const queryParams = req.query;

  // Handling multiple values for page and limit
  if (queryParams.page) {
    page = Array.isArray(queryParams.page)
      ? queryParams.page[0]
      : queryParams.page;
  }

  if (queryParams.limit) {
    limit = Array.isArray(queryParams.limit)
      ? queryParams.limit[0]
      : queryParams.limit;
  }

  // Adding filters to the path
  Object.keys(queryParams)
    .filter((key) => key !== "page" && key !== "limit")
    .forEach((key) => {
      const values = Array.isArray(queryParams[key])
        ? queryParams[key]
        : [queryParams[key]];
      values.forEach((value) => {
        path += `${key}=${encodeURIComponent(value)}&`;
      });
    });

  const totalPages = Math.ceil(count / limit);

  if (page < totalPages) {
    link.next = `${path}page=${Number(page) + 1}&limit=${limit}`;
  } else {
    link.next = "";
  }

  if (page > 1) {
    link.prev = `${path}page=${Number(page) - 1}&limit=${limit}`;
  } else {
    link.prev = "";
  }

  result.links = link;
  result.total_items = count;

  return result;
};

module.exports = { getPagination };
