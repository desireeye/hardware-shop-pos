export type ApiResponse<T> =
  | {
      success: true;
      message?: string;
      data?: T;
    }
  | {
      success: false;
      message: string;
      errorCode?: string;
    };

export const successResponse = <T>(message: string, data?: T): ApiResponse<T> => ({
  success: true,
  message,
  ...(data !== undefined ? { data } : {}),
});

export const errorResponse = (message: string, errorCode?: string): ApiResponse<never> => ({
  success: false,
  message,
  ...(errorCode ? { errorCode } : {}),
});
