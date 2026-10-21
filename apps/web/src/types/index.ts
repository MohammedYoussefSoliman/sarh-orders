export type ApiErrorResponse = {
  statusCode?: number;
  message?: string;
  error?: string;
  errors?: { path: string; message: string }[];
};
