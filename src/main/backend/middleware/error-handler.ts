import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  console.error('Backend request failed:', error);
  const message = error instanceof Error ? error.message : 'Unexpected backend error.';
  res.status(500).json({ message });
  void next;
};
