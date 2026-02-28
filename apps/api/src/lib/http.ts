import { z } from "zod";

export const parseBody = <S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`BAD_REQUEST:${parsed.error.issues.map((issue) => issue.message).join(",")}`);
  }

  return parsed.data;
};

export const parseError = (error: unknown): { statusCode: number; message: string } => {
  if (error instanceof Error) {
    if (error.message.startsWith("BAD_REQUEST:")) {
      return { statusCode: 400, message: error.message.replace("BAD_REQUEST:", "") };
    }

    if (error.message.includes("NOT_FOUND") || error.message.includes("INVITE_EXPIRED")) {
      return { statusCode: 404, message: error.message };
    }

    if (error.message.includes("UNAUTHORIZED")) {
      return { statusCode: 403, message: error.message };
    }

    if (error.message.startsWith("PREFLIGHT_FAILED")) {
      return { statusCode: 422, message: error.message };
    }

    if (error.message.includes("NOT_READY") || error.message.includes("NOT_EXECUTABLE") || error.message.includes("EXCEEDS")) {
      return { statusCode: 409, message: error.message };
    }

    return { statusCode: 400, message: error.message };
  }

  return { statusCode: 500, message: "UNKNOWN_ERROR" };
};
