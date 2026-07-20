/**
 * Custom 404 Route Not Found Middleware
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.originalUrl}`
  });
};

/**
 * Global Error Handler Middleware
 */
export const globalErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  // Log Kubernetes API or general execution errors
  console.error(`[Error Code ${statusCode}] Route: ${req.method} ${req.originalUrl}`);
  if (err.body) {
    // If the error was thrown by the Kubernetes Client library, log the full body content
    console.error('Kubernetes API Error Body:', JSON.stringify(err.body, null, 2));
  } else {
    console.error(err.stack || err.message || err);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'An internal server error occurred inside the Kubernetes Dashboard backend.'
  });
};
