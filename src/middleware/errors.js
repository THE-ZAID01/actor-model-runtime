export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(error, _req, res, _next) {
  console.error(error);

  const status =
    error.status ||
    (error.code === 11000 ? 409 : error.name === 'ValidationError' ? 400 : 500);

  res.status(status).json({
    error: error.message || 'Internal server error',
  });
}
